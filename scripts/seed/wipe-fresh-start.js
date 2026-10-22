/**
 * Fresh-start wipe: DynamoDB app data + local .data + S3 prefixes.
 *
 * **경고: 이 스크립트는 DynamoDB BediApp 테이블의 모든 항목과
 * S3 avatars/ schedule-images/ photos/ 를 삭제한다.
 * 2026-08 데모 기간에는 실행 금지.
 * 계정 자격증명만 복구하려면 scripts/seed/restore-dynamo-users.js 를 쓸 것.**
 *
 * Opt-in only — without --yes-really-wipe-everything this script exits
 * without deleting anything.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed/wipe-fresh-start.js --yes-really-wipe-everything
 *   node --env-file=.env.local scripts/seed/wipe-fresh-start.js --yes-really-wipe-everything --no-seed
 *   node --env-file=.env.local scripts/seed/wipe-fresh-start.js --yes-really-wipe-everything --skip-dynamo
 *   node --env-file=.env.local scripts/seed/wipe-fresh-start.js --yes-really-wipe-everything --skip-s3
 *
 * 계정은 앱이 시작할 때 환경 변수 비밀번호로 다시 만든다 (seed-accounts.ts).
 */
const fs = require("fs");
const path = require("path");
const {
  DynamoDBClient,
  DescribeTableCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require("@aws-sdk/client-s3");

const args = new Set(process.argv.slice(2));
const CONFIRMED = args.has("--yes-really-wipe-everything");
const NO_SEED = args.has("--no-seed");
const SKIP_DYNAMO = args.has("--skip-dynamo");
const SKIP_S3 = args.has("--skip-s3");
const SKIP_LOCAL = args.has("--skip-local");

// Accounts are recreated by the app at startup from JUDGE_PASSWORD /
// DEMO_CHILD_PASSWORD / DEMO_GUARDIAN_PASSWORD (src/backend/bootstrap/seed-accounts.ts).
const DEMO_USERS = [
  { email: "judge-child@beddy.test", role: "child" },
  { email: "judge-guardian@beddy.test", role: "guardian" },
  { email: "demo-child@beddy.test", role: "child" },
  { email: "demo-guardian@beddy.test", role: "guardian" },
];

function awsCreds() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  if (accessKeyId && secretAccessKey) {
    return {
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    };
  }
  return {};
}

async function countDynamoItems(doc, table) {
  let total = 0;
  let startKey;
  do {
    const page = await doc.send(
      new ScanCommand({
        TableName: table,
        ExclusiveStartKey: startKey,
        Select: "COUNT",
      })
    );
    total += page.Count || 0;
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return total;
}

async function wipeDynamo() {
  if (SKIP_DYNAMO) {
    console.log("[dynamo] skipped");
    return;
  }

  const table = process.env.BEDI_DDB_TABLE || "BediApp";
  const region =
    process.env.BEDI_DDB_REGION ||
    process.env.AWS_REGION ||
    "us-east-1";

  const raw = new DynamoDBClient({ region, ...awsCreds() });
  const doc = DynamoDBDocumentClient.from(raw, {
    marshallOptions: { removeUndefinedValues: true },
  });

  try {
    await raw.send(new DescribeTableCommand({ TableName: table }));
  } catch (error) {
    console.log(
      `[dynamo] table ${table} (@${region}) not found / unreachable — skip`,
      error instanceof Error ? error.message : error
    );
    return;
  }

  let deleted = 0;
  let startKey;
  do {
    const page = await doc.send(
      new ScanCommand({
        TableName: table,
        ExclusiveStartKey: startKey,
        ProjectionExpression: "pk, sk",
      })
    );
    const items = page.Items || [];
    for (let i = 0; i < items.length; i += 25) {
      const chunk = items.slice(i, i + 25);
      await doc.send(
        new BatchWriteCommand({
          RequestItems: {
            [table]: chunk.map((item) => ({
              DeleteRequest: { Key: { pk: item.pk, sk: item.sk } },
            })),
          },
        })
      );
      deleted += chunk.length;
    }
    startKey = page.LastEvaluatedKey;
  } while (startKey);

  console.log(`[dynamo] deleted ${deleted} items from ${table} (${region})`);
}

async function wipeLocalData() {
  if (SKIP_LOCAL) {
    console.log("[local] skipped");
    return;
  }

  const dataDir = path.join(process.cwd(), ".data");
  if (!fs.existsSync(dataDir)) {
    console.log("[local] .data missing — skip");
    return;
  }

  let n = 0;
  for (const name of fs.readdirSync(dataDir)) {
    if (!name.endsWith(".json")) continue;
    fs.writeFileSync(path.join(dataDir, name), "{}\n", "utf8");
    n += 1;
    console.log(`[local] cleared ${name}`);
  }

  for (const sub of ["avatars", "schedule-images"]) {
    const dir = path.join(dataDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      fs.unlinkSync(path.join(dir, name));
      n += 1;
    }
    console.log(`[local] cleared ${sub}/`);
  }

  console.log(`[local] done (${n} files touched)`);
}

async function wipeS3Prefix(bucket, region, prefix) {
  const s3 = new S3Client({ region, ...awsCreds() });
  let deleted = 0;
  let token;
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    const objs = listed.Contents || [];
    for (let i = 0; i < objs.length; i += 1000) {
      const chunk = objs.slice(i, i + 1000).filter((o) => o.Key);
      if (chunk.length === 0) continue;
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: chunk.map((o) => ({ Key: o.Key })),
            Quiet: true,
          },
        })
      );
      deleted += chunk.length;
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}

async function wipeS3() {
  if (SKIP_S3) {
    console.log("[s3] skipped");
    return;
  }

  const bucket = process.env.AVATAR_S3_BUCKET;
  if (!bucket) {
    console.log("[s3] skipped (no AVATAR_S3_BUCKET)");
    return;
  }

  const region =
    process.env.AVATAR_S3_REGION || process.env.AWS_REGION || "us-east-1";

  try {
    const a = await wipeS3Prefix(bucket, region, "avatars/");
    const b = await wipeS3Prefix(bucket, region, "schedule-images/");
    const c = await wipeS3Prefix(bucket, region, "photos/");
    console.log(
      `[s3] deleted avatars=${a}, schedule-images=${b}, photos=${c} from s3://${bucket}`
    );
  } catch (error) {
    console.warn(
      "[s3] wipe failed:",
      error instanceof Error ? error.message : error
    );
  }
}

async function printTargetsAndExitIfUnconfirmed() {
  const table = process.env.BEDI_DDB_TABLE || "BediApp";
  const region =
    process.env.BEDI_DDB_REGION ||
    process.env.AWS_REGION ||
    "us-east-1";
  const bucket = process.env.AVATAR_S3_BUCKET || "(unset)";

  let itemCount = "?";
  try {
    const raw = new DynamoDBClient({ region, ...awsCreds() });
    const doc = DynamoDBDocumentClient.from(raw, {
      marshallOptions: { removeUndefinedValues: true },
    });
    await raw.send(new DescribeTableCommand({ TableName: table }));
    itemCount = String(await countDynamoItems(doc, table));
  } catch {
    itemCount = "unreachable";
  }

  console.log("=== Beddy fresh-start wipe — targets ===");
  console.log(`  DynamoDB table : ${table} (@${region}) — ~${itemCount} items (ALL)`);
  console.log(`  S3 prefixes    : s3://${bucket}/avatars/`);
  console.log(`                   s3://${bucket}/schedule-images/`);
  console.log(`                   s3://${bucket}/photos/`);
  console.log(`  Local          : .data/*.json, .data/avatars/, .data/schedule-images/`);
  console.log("");
  console.log("Demo accounts (for reference; this script does NOT seed):");
  for (const u of DEMO_USERS) {
    console.log(`  ${u.email} (${u.role})`);
  }
  console.log("");
  console.log("계정은 서버를 다시 시작하면 환경 변수 비밀번호로 다시 만들어집니다.");
  console.log("");

  if (!CONFIRMED) {
    console.log("ABORT: nothing deleted.");
    console.log(
      "To actually wipe, pass --yes-really-wipe-everything (demo period: DO NOT)."
    );
    console.log("");
    console.log("Usage:");
    console.log(
      "  node --env-file=.env.local scripts/seed/wipe-fresh-start.js --yes-really-wipe-everything"
    );
    process.exit(1);
  }
}

async function main() {
  await printTargetsAndExitIfUnconfirmed();

  console.log("=== Beddy fresh-start wipe ===");
  console.log(
    `flags: confirmed=${CONFIRMED} dynamo=${!SKIP_DYNAMO} s3=${!SKIP_S3} local=${!SKIP_LOCAL} (accounts are re-created by the app at startup)`
  );
  if (NO_SEED) {
    console.log("(note: --no-seed is accepted but seeding is already disabled)");
  }

  await wipeDynamo();
  await wipeLocalData();
  await wipeS3();

  console.log("=== done ===");
  console.log("Restart the server to re-create the judge/demo accounts.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
