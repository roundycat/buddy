import { afterAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * A signed session outlives account deletion (another tab or device keeps its
 * cookie). After deletion that cookie must not reach the AI or store anything.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beddy-deleted-session-"));
process.env.BEDDY_DATA_DIR = dir;
process.env.PERSISTENCE = "json";
process.env.AUTH_PROVIDER = "json";
process.env.LLM_PROVIDER = "mock";
process.env.BEDDY_METRICS = "0";
process.env.AUTH_SESSION_SECRET = "deleted-session-secret-deleted-session";
delete process.env.BEDROCK_KB_ID;

const jar: { token?: string } = {};
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "bedi_session" && jar.token ? { value: jar.token } : undefined),
  }),
}));

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const PASSWORD = "Delete#2026ok";
const agreements = { terms: true, privacy: true, sensitive: true, ageOrGuardian: true, marketing: false };

function chat(message: string) {
  return new Request("http://localhost/api/conversation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

describe("deleted account", () => {
  it("its old cookie is rejected and nothing is collected again", async () => {
    const { signup } = await import("./auth.service");
    const child = await signup({
      email: "deleted-child@x.test",
      password: PASSWORD,
      name: "아이",
      role: "child",
      childAgeBand: "under14",
      agreements,
    } as never);
    const guardian = await signup({
      email: "deleted-guardian@x.test",
      password: PASSWORD,
      name: "보호자",
      role: "guardian",
      agreements,
    } as never);
    const { getOrCreateChildInvite, linkGuardianWithCode } = await import(
      "@/backend/features/guardian-link/guardian-link.service"
    );
    await linkGuardianWithCode(guardian.user.id, (await getOrCreateChildInvite(child.user.id)).code);
    const { grantGuardianConsent } = await import("@/backend/features/consent/consent.service");
    await grantGuardianConsent(guardian.user.id, {
      relationship: "mother",
      guardianName: "엄마",
      items: { privacyCollection: true, sensitiveData: true, aiFeatures: true },
    });

    const { POST } = await import("@/app/api/conversation/route");
    jar.token = child.token;
    expect((await POST(chat("안녕"))).status).toBe(200);

    const { deleteAccount } = await import("./auth.delete.service");
    await deleteAccount(child.user);

    const res = await POST(chat("나 아직 여기 있어"));
    expect(res.status).toBe(401);
    await new Promise((r) => setTimeout(r, 200));
    const { getConversationHistory } = await import("@/backend/features/conversation/conversation.store");
    expect(await getConversationHistory(child.user.id)).toEqual([]);

    // The guardian's session is untouched.
    jar.token = guardian.token;
    const { getSessionUser } = await import("@/backend/shared/http/auth");
    expect((await getSessionUser())?.id).toBe(guardian.user.id);
  });
});

describe("consent withdrawn while a reply streams", () => {
  it("nothing of that turn is written back after the erase", async () => {
    const { signup } = await import("./auth.service");
    const child = await signup({
      email: "midstream-child@x.test",
      password: PASSWORD,
      name: "아이",
      role: "child",
      childAgeBand: "under14",
      agreements,
    } as never);
    const guardian = await signup({
      email: "midstream-guardian@x.test",
      password: PASSWORD,
      name: "보호자",
      role: "guardian",
      agreements,
    } as never);
    const { getOrCreateChildInvite, linkGuardianWithCode } = await import(
      "@/backend/features/guardian-link/guardian-link.service"
    );
    await linkGuardianWithCode(guardian.user.id, (await getOrCreateChildInvite(child.user.id)).code);
    const consent = await import("@/backend/features/consent/consent.service");
    await consent.grantGuardianConsent(guardian.user.id, {
      relationship: "father",
      guardianName: "아빠",
      items: { privacyCollection: true, sensitiveData: true, aiFeatures: true },
    });

    const { POST } = await import("@/app/api/conversation/route");
    jar.token = child.token;
    const res = await POST(
      new Request("http://localhost/api/conversation?stream=1", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ message: "오늘 병원 밥이 맛있었어. 너는 무슨 음식 좋아해?" }),
      })
    );
    const reader = res.body!.getReader();
    await reader.read();
    await consent.withdrawGuardianConsent(guardian.user.id);
    while (!(await reader.read()).done) {
      /* drain */
    }
    await new Promise((r) => setTimeout(r, 300));
    const { getConversationHistory } = await import("@/backend/features/conversation/conversation.store");
    expect(await getConversationHistory(child.user.id)).toEqual([]);
  });
});

