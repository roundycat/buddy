import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Consent withdrawal and account deletion erase the child's data in every
 * store, while the account, consent records and guardian link stay.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beddy-erase-"));
process.env.BEDDY_DATA_DIR = dir;
process.env.PERSISTENCE = "json";
process.env.AUTH_PROVIDER = "json";
delete process.env.BEDROCK_KB_ID;
delete process.env.AVATAR_S3_BUCKET;

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const CHILD = "child-erase-1";
const GUARDIAN = "guardian-erase-1";

async function seedChildData() {
  const { appendConversationMessages, getConversationHistory } = await import(
    "@/backend/features/conversation/conversation.store"
  );
  await appendConversationMessages(CHILD, [
    { id: "u1", role: "user", content: "비밀인데 무서워", createdAt: new Date().toISOString() },
  ]);
  const { recordSafetySignal, getSafetySignalLog } = await import("@/backend/ai/safety/v2/signal-log.store");
  await recordSafetySignal(CHILD, {
    level: "watch",
    categories: ["S8_loneliness"],
    rules: [],
    suppressors: [],
    thirdParty: false,
    contextRaised: false,
    abuse: false,
    ambiguous: false,
  });
  const { createChildSafetyAlert, getActiveChildSafetyAlert } = await import(
    "@/backend/features/safety/safety-alert.store"
  );
  await createChildSafetyAlert({ childUserId: CHILD, summary: "도움이 필요해요", level: "elevated" });
  const { saveCoarseLocation, getCoarseLocation } = await import("@/backend/features/weather/weather.store");
  await saveCoarseLocation(CHILD, 37.28, 127.9);
  const { appendEmotionRecord, listEmotionRecords } = await import("@/backend/features/emotion-analysis/emotion.store");
  await appendEmotionRecord({ userId: CHILD, createdAt: new Date().toISOString() } as never);
  const { putLocalSummaryDoc, searchLocalSummaries } = await import("@/backend/ai/kb/local-kb");
  putLocalSummaryDoc({ childUserId: CHILD, dateKey: "2026-10-22", kind: "emotion", markdown: "# t\n\n- 기분 불안\n" });
  const { savePreparedParentSummary, getPreparedParentSummary } = await import(
    "@/backend/features/parent/parent-daily-prep.store"
  );
  await savePreparedParentSummary({ guardianUserId: GUARDIAN, childUserId: CHILD, dateKey: "2026-10-22" } as never);

  return {
    async remaining() {
      return {
        chat: (await getConversationHistory(CHILD)).length,
        signals: (await getSafetySignalLog(CHILD))?.events.length ?? 0,
        alert: Boolean(await getActiveChildSafetyAlert(CHILD)),
        location: Boolean(await getCoarseLocation(CHILD)),
        emotion: (await listEmotionRecords(CHILD)).length,
        kb: searchLocalSummaries({ childUserId: CHILD, query: "기분" }).length,
        prep: Boolean(await getPreparedParentSummary(GUARDIAN, "2026-10-22")),
      };
    },
  };
}

describe("child data erase", () => {
  it("guardian withdrawal erases collected data but keeps account, consent records and link", async () => {
    const { createJsonUser, findJsonUserById } = await import("@/backend/features/auth/auth.users.json.repo");
    await createJsonUser({ id: CHILD, email: "erase-kid@beddy.test", name: "가을", role: "child", password: "Kid#2026ok" });
    await createJsonUser({ id: GUARDIAN, email: "erase-mom@beddy.test", name: "가을 엄마", role: "guardian", password: "Mom#2026ok" });
    const { saveLink, getLinkForGuardian } = await import("@/backend/features/guardian-link/guardian-link.store");
    await saveLink({ guardianUserId: GUARDIAN, childUserId: CHILD, linkedAt: new Date().toISOString(), inviteCode: "T" });
    const consent = await import("@/backend/features/consent/consent.service");
    await consent.recordChildSignupConsent({ childUserId: CHILD, childName: "가을", ageBand: "under14" });
    await consent.grantGuardianConsent(GUARDIAN, {
      relationship: "mother",
      guardianName: "김엄마",
      items: { privacyCollection: true, sensitiveData: true, aiFeatures: true },
    });

    const data = await seedChildData();
    expect(await data.remaining()).toEqual({
      chat: 1, signals: 1, alert: true, location: true, emotion: 1, kb: 1, prep: true,
    });

    const view = await consent.withdrawGuardianConsent(GUARDIAN);
    expect(view.status).toBe("pending");
    expect(await data.remaining()).toEqual({
      chat: 0, signals: 0, alert: false, location: false, emotion: 0, kb: 0, prep: false,
    });

    // Kept: login account, proof of consent (now withdrawn), guardian link.
    expect(await findJsonUserById(CHILD)).not.toBeNull();
    const { listGuardianConsentsForChild } = await import("@/backend/features/consent/consent.store");
    const records = await listGuardianConsentsForChild(CHILD);
    expect(records).toHaveLength(1);
    expect(records[0]!.withdrawnAt).toBeTruthy();
    expect((await getLinkForGuardian(GUARDIAN))?.childUserId).toBe(CHILD);
  });

  it("account deletion removes the rest, including consent state and the login row", async () => {
    const { deleteAccount } = await import("@/backend/features/auth/auth.delete.service");
    const { findJsonUserById } = await import("@/backend/features/auth/auth.users.json.repo");
    const { getChildConsentState } = await import("@/backend/features/consent/consent.store");
    await deleteAccount({ id: CHILD, email: "erase-kid@beddy.test", name: "가을", role: "child" });
    expect(await findJsonUserById(CHILD)).toBeNull();
    expect(await getChildConsentState(CHILD)).toBeFalsy();
  });
});
