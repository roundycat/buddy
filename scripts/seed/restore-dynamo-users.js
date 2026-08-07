/**
 * Restore DynamoDB auth credentials for EXISTING userIds.
 *
 * Why this exists:
 *   Task definitions rev 12–14 ran with AUTH_PROVIDER=aurora while
 *   PERSISTENCE=dynamodb. App data went to DynamoDB, credentials went to
 *   Aurora. Rev 15 switched AUTH_PROVIDER to dynamodb without migrating the
 *   users, so accounts created before 2026-08-05 14:28 KST get a 401 even
 *   though all of their app data is still in the BediApp table.
 *
 * This script writes only the two credential records:
 *   pk=EMAIL#<email>  sk=UNIQUE   -> userId
 *   pk=USER#<userId>  sk=PROFILE  -> name, role, passwordHash
 * It reuses the SAME userId, so personas / conversations / memories /
 * guardian-links stay linked. It never touches MAP# app data.
 *
 * Passwords are NOT hardcoded — they come from the RESTORE_USERS env var so
 * nothing secret lands in git.
 *
 * Usage A — inline (PowerShell):
 *   $env:RESTORE_USERS = '[{"id":"user-...","email":"a@b.com","name":"이름","role":"child","password":"..."}]'
 *   node --env-file=.env.local scripts/seed/restore-dynamo-users.js
 *   Remove-Item Env:RESTORE_USERS
 *
 * Usage B — file (keep the file OUTSIDE this repo, it holds plaintext passwords):
 *   $env:RESTORE_USERS_FILE = "$env:TEMP\restore-users.json"
 *   node --env-file=.env.local scripts/seed/restore-dynamo-users.js --dry-run
 *   Remove-Item $env:RESTORE_USERS_FILE
 *
 * Flags:
 *   --dry-run   show what would change, write nothing
 *   --force     allow rebinding an email that currently points to another userId
 */
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand,
  TransactWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const bcrypt = require("bcryptjs");

const argv = process.argv.slice(2);
const args = new Set(argv);
const DRY_RUN = args.has("--dry-run");
const FORCE = args.has("--force");

function argValue(name) {
  const i = argv.indexOf(name);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--")) {
    return argv[i + 1];
  }
  return undefined;
}
const FILE_ARG = argValue("--file");

const TABLE = process.env.BEDI_DDB_TABLE || "BediApp";
const REGION = process.env.BEDI_DDB_REGION || process.env.AWS_REGION || "us-east-1";

/** Mirrors src/shared/auth/password.ts — keep in sync. */
const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
function passwordProblems(password) {
  const problems = [];
  if (!(password.length >= 8 && password.length <= 20)) {
    problems.push("8자 이상 20자 이하");
  }
  if (!/[A-Za-z]/.test(password)) problems.push("영문 포함");
  if (!/[0-9]/.test(password)) problems.push("숫자 포함");
  if (!SPECIAL_RE.test(password)) problems.push("특수문자 포함");
  return problems;
}

function emailPk(email) {
  return `EMAIL#${email.trim().toLowerCase()}`;
}
function userPk(id) {
  return `USER#${id}`;
}

function readRawInput() {
  const file = (FILE_ARG || process.env.RESTORE_USERS_FILE || "").trim();
  if (file) {
    // Keep this file OUTSIDE the repo — it holds plaintext passwords.
    return require("fs").readFileSync(file, "utf8");
  }
  return process.env.RESTORE_USERS;
}

function parseInput() {
  const raw = readRawInput();
  if (!raw || !raw.trim()) {
    throw new Error(
      "RESTORE_USERS 또는 RESTORE_USERS_FILE 이 비어 있습니다. 사용법은 파일 상단 주석을 보세요."
    );
  }
  let list;
  try {
    list = JSON.parse(raw);
  } catch (error) {
    throw new Error(`RESTORE_USERS JSON 파싱 실패: ${error.message}`);
  }
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("RESTORE_USERS 는 비어 있지 않은 배열이어야 합니다.");
  }

  for (const [i, u] of list.entries()) {
    const at = `RESTORE_USERS[${i}]`;
    if (!u || typeof u !== "object") throw new Error(`${at} 가 객체가 아닙니다.`);
    for (const key of ["id", "email", "name", "role", "password"]) {
      if (typeof u[key] !== "string" || !u[key].trim()) {
        throw new Error(`${at}.${key} 가 비어 있습니다.`);
      }
    }
    if (u.role !== "child" && u.role !== "guardian") {
      throw new Error(`${at}.role 은 "child" 또는 "guardian" 이어야 합니다.`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email.trim())) {
      throw new Error(`${at}.email 형식이 올바르지 않습니다.`);
    }
    const problems = passwordProblems(u.password);
    if (problems.length > 0) {
      throw new Error(
        `${at}.password 가 앱 정책을 통과하지 못합니다 — 필요: ${problems.join(", ")}`
      );
    }
  }
  return list;
}

function makeDocClient() {
  const raw = new DynamoDBClient({
    region: REGION,
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            ...(process.env.AWS_SESSION_TOKEN
              ? { sessionToken: process.env.AWS_SESSION_TOKEN }
              : {}),
          },
        }
      : {}),
  });
  return DynamoDBDocumentClient.from(raw, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

/**
 * Read current state for one requested restore.
 * No writes here — planning only, so a batch can be validated as a whole.
 */
async function inspect(doc, u) {
  const email = u.email.trim().toLowerCase();

  const [profileRes, emailRes] = await Promise.all([
    doc.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: userPk(u.id), sk: "PROFILE" },
      })
    ),
    doc.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: emailPk(email), sk: "UNIQUE" },
      })
    ),
  ]);

  return {
    ...u,
    email,
    label: `${email} (${u.role}) -> ${u.id}`,
    existingProfile: profileRes.Item || null,
    boundTo: emailRes.Item?.userId || null,
  };
}

/**
 * Delete-all-then-write-all.
 *
 * Doing this per item breaks swaps: with A->1 / B->2 currently stored and
 * A->2 / B->1 requested, handling A first writes USER#2 PROFILE, then
 * handling B deletes USER#2 PROFILE because it is still the stale owner of B.
 * Clearing every stale record before writing any new one removes that
 * ordering hazard entirely.
 */
async function applyPlan(doc, plans) {
  // Phase 1 — drop stale credential records (app data is never touched).
  const emailKeysToDelete = new Set();
  const profileIdsToDelete = new Set();

  for (const p of plans) {
    if (p.boundTo) {
      emailKeysToDelete.add(p.email);
      if (p.boundTo !== p.id) profileIdsToDelete.add(p.boundTo);
    }
  }

  for (const email of emailKeysToDelete) {
    await doc.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { pk: emailPk(email), sk: "UNIQUE" },
      })
    );
    console.log(`[clear] EMAIL#${email}`);
  }
  for (const id of profileIdsToDelete) {
    await doc.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { pk: userPk(id), sk: "PROFILE" },
      })
    );
    console.log(`[clear] USER#${id} PROFILE`);
  }

  // Phase 2 — write the requested bindings.
  for (const p of plans) {
    const passwordHash = await bcrypt.hash(p.password, 10);
    const createdAt =
      (p.existingProfile && p.existingProfile.createdAt) ||
      new Date().toISOString();

    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE,
              Item: {
                pk: emailPk(p.email),
                sk: "UNIQUE",
                userId: p.id,
                createdAt,
              },
            },
          },
          {
            Put: {
              TableName: TABLE,
              Item: {
                pk: userPk(p.id),
                sk: "PROFILE",
                userId: p.id,
                email: p.email,
                name: p.name.trim(),
                role: p.role,
                passwordHash,
                createdAt,
                restoredAt: new Date().toISOString(),
              },
            },
          },
        ],
      })
    );
    console.log(`[ok] ${p.label}`);
  }
}

async function main() {
  const list = parseInput();
  console.log(
    `=== restore-dynamo-users === table=${TABLE} region=${REGION} ` +
      `dryRun=${DRY_RUN} force=${FORCE} count=${list.length}`
  );

  const doc = makeDocClient();
  const plans = [];
  for (const u of list) {
    plans.push(await inspect(doc, u));
  }

  // Reject the whole batch when an email would be taken from another user
  // without an explicit --force.
  const rebinds = plans.filter((p) => p.boundTo && p.boundTo !== p.id);
  if (rebinds.length > 0 && !FORCE) {
    for (const p of rebinds) {
      console.error(
        `[abort] ${p.label}\n` +
          `        이 이메일은 이미 ${p.boundTo} 에 연결되어 있습니다.`
      );
    }
    console.error("의도한 재바인딩이면 --force 를 붙여 다시 실행하세요.");
    process.exitCode = 1;
    return;
  }

  for (const p of plans) {
    const action = p.existingProfile ? "덮어쓰기" : "신규 생성";
    const note = p.boundTo
      ? p.boundTo === p.id
        ? " (같은 userId 재바인딩)"
        : ` (기존 바인딩 ${p.boundTo} 해제)`
      : "";
    console.log(`[plan] ${p.label} — ${action}${note}`);
  }

  if (DRY_RUN) {
    console.log("=== dry-run === 아무것도 쓰지 않았습니다.");
    return;
  }

  await applyPlan(doc, plans);
  console.log(`=== done === ${plans.length}건 적용`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
