import "server-only";
import { env } from "@/backend/shared/config/env";
import { passwordValidationMessage } from "@/shared/auth/password";
import {
  findUserByEmail,
  upsertUser,
  verifyUserPassword,
} from "@/backend/features/auth/auth.users.repo";
import {
  getLinkForGuardian,
  saveLink,
} from "@/backend/features/guardian-link/guardian-link.store";
import { getChildConsentState } from "@/backend/features/consent/consent.store";
import {
  grantGuardianConsent,
  recordChildSignupConsent,
} from "@/backend/features/consent/consent.service";

/**
 * Demo and judge accounts, created when the server starts (any stored-user
 * provider: data-directory files or DynamoDB; never the mock provider).
 * Passwords come only from the environment — never from the repository.
 *
 * Each pair is a child account plus a guardian account already linked to it.
 * The child is registered as under 14 and the seeded guardian gives the legal
 * consent (with a consent record), so the gate is open from the first login and
 * judges can try "동의 철회" to see it close.
 *
 *   judge: JUDGE_PASSWORD
 *          → judge-child@beddy.test / judge-guardian@beddy.test
 *   demo:  DEMO_CHILD_PASSWORD / DEMO_GUARDIAN_PASSWORD (or DEMO_PASSWORD for both)
 *          → demo-child@beddy.test / demo-guardian@beddy.test
 *
 * Idempotent: an account is rewritten only when it is missing or its password
 * changed; user ids stay the same, so the child's data is kept. Consent is set
 * only once — a later withdrawal is respected across restarts.
 */

type SeedUser = { id: string; email: string; name: string };

type SeedPair = {
  label: "judge" | "demo";
  childPasswordEnv: string[];
  guardianPasswordEnv: string[];
  child: SeedUser;
  guardian: SeedUser;
};

export const SEED_PAIRS: SeedPair[] = [
  {
    label: "judge",
    childPasswordEnv: ["JUDGE_PASSWORD"],
    guardianPasswordEnv: ["JUDGE_PASSWORD"],
    child: { id: "user-judge-child", email: "judge-child@beddy.test", name: "하늘" },
    guardian: { id: "user-judge-guardian", email: "judge-guardian@beddy.test", name: "하늘 보호자" },
  },
  {
    label: "demo",
    childPasswordEnv: ["DEMO_CHILD_PASSWORD", "DEMO_PASSWORD"],
    guardianPasswordEnv: ["DEMO_GUARDIAN_PASSWORD", "DEMO_PASSWORD"],
    child: { id: "user-demo-child", email: "demo-child@beddy.test", name: "지민" },
    guardian: { id: "user-demo-guardian", email: "demo-guardian@beddy.test", name: "지민 보호자" },
  },
];

function firstEnv(keys: string[]): { key: string; value: string } | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return { key, value };
  }
  return null;
}

async function ensureUser(
  user: SeedUser,
  role: "child" | "guardian",
  password: string
): Promise<"created" | "kept"> {
  const existing = await findUserByEmail(user.email);
  if (
    existing &&
    existing.userId === user.id &&
    (await verifyUserPassword(password, existing.passwordHash))
  ) {
    return "kept";
  }
  await upsertUser({ ...user, role, password });
  return "created";
}

async function ensureLinkAndConsent(pair: SeedPair) {
  const link = await getLinkForGuardian(pair.guardian.id);
  if (!link || link.childUserId !== pair.child.id) {
    await saveLink({
      guardianUserId: pair.guardian.id,
      childUserId: pair.child.id,
      linkedAt: new Date().toISOString(),
      inviteCode: "SEED",
    });
  }
  if (await getChildConsentState(pair.child.id)) return;
  await recordChildSignupConsent({
    childUserId: pair.child.id,
    childName: pair.child.name,
    ageBand: "under14",
  });
  await grantGuardianConsent(pair.guardian.id, {
    relationship: "mother",
    guardianName: pair.guardian.name,
    items: { privacyCollection: true, sensitiveData: true, aiFeatures: true },
  });
}

export async function ensureSeedAccounts(): Promise<string[]> {
  if (env.authProvider === "mock") return [];
  const done: string[] = [];
  for (const pair of SEED_PAIRS) {
    const childPw = firstEnv(pair.childPasswordEnv);
    const guardianPw = firstEnv(pair.guardianPasswordEnv);
    if (!childPw || !guardianPw) continue;
    const invalid = [childPw, guardianPw]
      .map((p) => ({ key: p.key, problem: passwordValidationMessage(p.value) }))
      .find((p) => p.problem);
    if (invalid) {
      console.warn(`[seed] ${pair.label} skipped: ${invalid.key} — ${invalid.problem}`);
      continue;
    }
    const child = await ensureUser(pair.child, "child", childPw.value);
    const guardian = await ensureUser(pair.guardian, "guardian", guardianPw.value);
    await ensureLinkAndConsent(pair);
    done.push(`${pair.label}:${child}/${guardian}`);
  }
  if (done.length) console.info(`[seed] accounts ready (${done.join(", ")})`);
  return done;
}
