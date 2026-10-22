import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Hosting without AWS: file-backed accounts + seeding, local summary search,
 * in-process dawn batch. Everything runs against a temporary data directory.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beddy-nonaws-"));
process.env.BEDDY_DATA_DIR = dir;
process.env.AUTH_PROVIDER = "json";
process.env.PERSISTENCE = "json";
process.env.JUDGE_PASSWORD = "Judge#2026ok";
process.env.DEMO_PASSWORD = "short";
process.env.AUTH_SESSION_SECRET = "test-secret-test-secret-test-secret-123";
delete process.env.BEDROCK_KB_ID;

const runDailyBatch = vi.fn(async (dateKey: string) => ({ dateKey }));
vi.mock("@/backend/features/batch/run-daily-batch", () => ({ runDailyBatch }));

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("file-backed accounts", () => {
  beforeAll(() => vi.spyOn(console, "warn").mockImplementation(() => undefined));

  it("seeds the judge pair once, skips a password that breaks the rules", async () => {
    const { ensureSeedAccounts } = await import("./seed-accounts");
    expect(await ensureSeedAccounts()).toEqual(["judge:created/created"]);
    expect(await ensureSeedAccounts()).toEqual(["judge:kept/kept"]);

    const { getLinkForGuardian } = await import("@/backend/features/guardian-link/guardian-link.store");
    expect((await getLinkForGuardian("user-judge-guardian"))?.childUserId).toBe("user-judge-child");

    // Under-14 child with the seeded guardian's legal consent on record.
    const { getChildConsentState, listGuardianConsentsForChild } = await import(
      "@/backend/features/consent/consent.store"
    );
    expect(await getChildConsentState("user-judge-child")).toMatchObject({
      ageBand: "under14",
      status: "granted",
      basis: "guardian",
    });
    expect((await listGuardianConsentsForChild("user-judge-child")).length).toBe(1);

    const { findJsonUserByEmail } = await import("@/backend/features/auth/auth.users.json.repo");
    expect(await findJsonUserByEmail("demo-child@beddy.test")).toBeNull();
  });

  it("logs in through the auth service and rejects a wrong password", async () => {
    const { login } = await import("@/backend/features/auth/auth.service");
    const ok = await login({ email: "JUDGE-CHILD@beddy.test", password: "Judge#2026ok" });
    expect(ok.user).toMatchObject({ id: "user-judge-child", role: "child", name: "하늘" });
    expect(ok.token.length).toBeGreaterThan(20);
    await expect(login({ email: "judge-child@beddy.test", password: "Wrong#2026ok" })).rejects.toMatchObject({
      status: 401,
    });
  });

  it("keeps e-mails unique and writes bcrypt hashes to disk", async () => {
    const { createJsonUser } = await import("@/backend/features/auth/auth.users.json.repo");
    await expect(
      createJsonUser({ id: "u-x", email: "judge-child@beddy.test", name: "x", role: "child", password: "Aa1!aaaa" })
    ).rejects.toThrow("DUPLICATE_EMAIL");

    const { flushJsonMapStores } = await import("@/backend/shared/persist/json-map-store");
    flushJsonMapStores();
    const raw = fs.readFileSync(path.join(dir, "auth-users.json"), "utf8");
    expect(raw).toContain("$2");
    expect(raw).not.toContain("Judge#2026ok");
  });
});

describe("shared JSON map per file", () => {
  it("two stores on one file see each other's writes", async () => {
    const { createJsonMapStore, flushJsonMapStores } = await import("@/backend/shared/persist/json-map-store");
    const a = createJsonMapStore<{ v: number }>("shared-test.json");
    const b = createJsonMapStore<{ v: number }>("shared-test.json");
    a.set("one", { v: 1 });
    b.set("two", { v: 2 });
    flushJsonMapStores();
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, "shared-test.json"), "utf8"));
    expect(Object.keys(onDisk).sort()).toEqual(["one", "two"]);
  });
});

describe("local summary search", () => {
  it("ranks by the guardian's question and never crosses children", async () => {
    const { putLocalSummaryDoc, searchLocalSummaries } = await import("@/backend/ai/kb/local-kb");
    const doc = (kind: string, body: string) =>
      `# t\n\nchildUserId: c1\ndate: 2026-10-22\nkind: ${kind}\n\n${body}\n`;
    putLocalSummaryDoc({ childUserId: "c1", dateKey: "2026-10-22", kind: "emotion", markdown: doc("emotion", "- 2026-10-22: 조금 불안\n- 2026-10-21: 기쁨") });
    putLocalSummaryDoc({ childUserId: "c1", dateKey: "2026-10-22", kind: "mission", markdown: doc("mission", "- [done] 간호사 선생님께 인사하기") });

    const hits = searchLocalSummaries({ childUserId: "c1", query: "요즘 아이 기분은 어때요?" });
    expect(hits[0]?.sourceLabel).toBe("감정 이력");
    expect(hits[0]?.text).toContain("불안");
    expect(hits[0]?.text).not.toContain("childUserId");
    expect(searchLocalSummaries({ childUserId: "c2", query: "기분" })).toEqual([]);
  });
});

describe("in-process dawn batch", () => {
  it("waits for 05:00 KST, then runs once per day", async () => {
    const { runScheduledBatchIfDue } = await import("./daily-scheduler");
    const before = new Date("2026-10-22T19:30:00Z"); // 04:30 KST
    const after = new Date("2026-10-22T20:10:00Z"); // 05:10 KST
    expect(await runScheduledBatchIfDue(before)).toBe("skipped");
    expect(await runScheduledBatchIfDue(after)).toBe("ran");
    expect(await runScheduledBatchIfDue(new Date("2026-10-22T23:00:00Z"))).toBe("skipped");
    expect(runDailyBatch).toHaveBeenCalledTimes(1);
  });
});
