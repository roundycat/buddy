import { afterAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Under 14, nothing is collected or generated before a guardian consents —
 * on every child endpoint, not only the chat.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beddy-consent-routes-"));
process.env.BEDDY_DATA_DIR = dir;
process.env.PERSISTENCE = "json";
process.env.AUTH_PROVIDER = "json";
process.env.LLM_PROVIDER = "mock";
process.env.BEDDY_METRICS = "0";
delete process.env.BEDROCK_KB_ID;

const CHILD = { id: "pending-child", email: "pending@x.test", name: "아이", role: "child" as const };

vi.mock("@/backend/shared/http/auth", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    requireAuthUser: async () => CHILD,
    requireChildUser: async () => CHILD,
    getSessionUser: async () => CHILD,
  };
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const json = (url: string, method: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("a pending under-14 child", () => {
  it("is refused (403) by every child data endpoint and nothing is stored", async () => {
    const { recordChildSignupConsent } = await import("./consent.service");
    await recordChildSignupConsent({ childUserId: CHILD.id, ageBand: "under14" });

    const calls: Array<[string, () => Promise<Response>]> = [
      ["weather POST", async () => (await import("@/app/api/weather/route")).POST(json("/api/weather", "POST", { lat: 37.5665, lon: 126.978 }))],
      ["weather GET", async () => (await import("@/app/api/weather/route")).GET()],
      ["timeline GET", async () => (await import("@/app/api/timeline/route")).GET()],
      ["memory GET", async () => (await import("@/app/api/memory/route")).GET()],
      ["adventure progress", async () => (await import("@/app/api/adventure/progress/route")).POST(json("/api/adventure/progress", "POST", { questId: "q1", note: "비밀" }))],
      ["wallet GET", async () => (await import("@/app/api/wallet/route")).GET()],
      ["wallet claim", async () => (await import("@/app/api/wallet/claim/route")).POST(json("/api/wallet/claim", "POST", { questId: "q1" }))],
      ["bond GET", async () => (await import("@/app/api/companion/bond/route")).GET()],
      ["garden water", async () => (await import("@/app/api/garden/water/route")).POST(json("/api/garden/water", "POST", { flowerId: "f1" }))],
      ["garden care", async () => (await import("@/app/api/garden/care/route")).POST(json("/api/garden/care", "POST", {}))],
      ["garden storybook", async () => (await import("@/app/api/garden/storybook/route")).POST()],
      ["hospital-day GET", async () => (await import("@/app/api/hospital-day/route")).GET(json("/api/hospital-day", "GET"))],
      ["storybook progress", async () => (await import("@/app/api/storybook/progress/route")).PATCH(json("/api/storybook/progress", "PATCH", { page: 1 }))],
      ["sharing PATCH", async () => (await import("@/app/api/sharing/route")).PATCH(json("/api/sharing", "PATCH", { choices: { media: "share" } }))],
      ["concern answer", async () => (await import("@/app/api/sharing/concern/route")).POST(json("/api/sharing/concern", "POST", { id: "x", answer: "share" }))],
    ];
    for (const [name, call] of calls) {
      const res = await call();
      expect(res.status, name).toBe(403);
    }

    const { getCoarseLocation } = await import("@/backend/features/weather/weather.store");
    expect(await getCoarseLocation(CHILD.id)).toBeNull();
    const { getAdventurePack } = await import("@/backend/features/adventure-quest/adventure-quest.store");
    const { todayKey } = await import("@/backend/shared/time/date");
    expect(await getAdventurePack(CHILD.id, todayKey())).toBeNull();
  });
});
