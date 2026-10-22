import "server-only";
import { env } from "@/backend/shared/config/env";
import { passwordValidationMessage } from "@/shared/auth/password";
import {
  findJsonUserByEmail,
  upsertJsonUser,
  verifyJsonPassword,
} from "@/backend/features/auth/auth.users.json.repo";
import {
  getLinkForGuardian,
  saveLink,
} from "@/backend/features/guardian-link/guardian-link.store";

/**
 * Demo and judge accounts for a fresh deployment without DynamoDB
 * (AUTH_PROVIDER=json). Passwords come only from the environment — never from
 * the repository. Each pair is a child account plus a guardian account already
 * linked to it, so the guardian screens work from the first login.
 *
 *   JUDGE_PASSWORD → judge-child@beddy.test / judge-guardian@beddy.test
 *   DEMO_PASSWORD  → demo-child@beddy.test  / demo-guardian@beddy.test
 *
 * Idempotent: an account is rewritten only when it is missing or its password
 * changed; user ids stay the same, so the child's data is kept.
 */

type SeedPair = {
  passwordEnv: "JUDGE_PASSWORD" | "DEMO_PASSWORD";
  child: { id: string; email: string; name: string };
  guardian: { id: string; email: string; name: string };
};

export const SEED_PAIRS: SeedPair[] = [
  {
    passwordEnv: "JUDGE_PASSWORD",
    child: { id: "user-judge-child", email: "judge-child@beddy.test", name: "하늘" },
    guardian: { id: "user-judge-guardian", email: "judge-guardian@beddy.test", name: "하늘 보호자" },
  },
  {
    passwordEnv: "DEMO_PASSWORD",
    child: { id: "user-demo-child", email: "demo-child@beddy.test", name: "지민" },
    guardian: { id: "user-demo-guardian", email: "demo-guardian@beddy.test", name: "지민 보호자" },
  },
];

async function ensureUser(
  user: { id: string; email: string; name: string },
  role: "child" | "guardian",
  password: string
): Promise<"created" | "kept"> {
  const existing = await findJsonUserByEmail(user.email);
  if (
    existing &&
    existing.userId === user.id &&
    (await verifyJsonPassword(password, existing.passwordHash))
  ) {
    return "kept";
  }
  await upsertJsonUser({ ...user, role, password });
  return "created";
}

export async function ensureSeedAccounts(): Promise<string[]> {
  if (env.authProvider !== "json") return [];
  const done: string[] = [];
  for (const pair of SEED_PAIRS) {
    const password = process.env[pair.passwordEnv]?.trim();
    if (!password) continue;
    const invalid = passwordValidationMessage(password);
    if (invalid) {
      console.warn(`[seed] ${pair.passwordEnv} skipped: ${invalid}`);
      continue;
    }
    const child = await ensureUser(pair.child, "child", password);
    const guardian = await ensureUser(pair.guardian, "guardian", password);
    const link = await getLinkForGuardian(pair.guardian.id);
    if (!link || link.childUserId !== pair.child.id) {
      await saveLink({
        guardianUserId: pair.guardian.id,
        childUserId: pair.child.id,
        linkedAt: new Date().toISOString(),
        inviteCode: "SEED",
      });
    }
    done.push(`${pair.passwordEnv}:${child}/${guardian}`);
  }
  if (done.length) console.info(`[seed] accounts ready (${done.join(", ")})`);
  return done;
}
