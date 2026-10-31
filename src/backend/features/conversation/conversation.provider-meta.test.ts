import { afterAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * A saved reply names who actually answered. With Claude configured but no key
 * (or past the daily cap) the offline persona answers, and the deploy smoke test
 * relies on this to warn that the key is missing.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beddy-provider-meta-"));
process.env.BEDDY_DATA_DIR = dir;
process.env.PERSISTENCE = "json";
process.env.AUTH_PROVIDER = "json";
process.env.LLM_PROVIDER = "anthropic";
delete process.env.ANTHROPIC_API_KEY;
process.env.BEDDY_METRICS = "0";
process.env.AUTH_SESSION_SECRET = "meta-secret-meta-secret-meta-secret-123";

const user = vi.hoisted(() => ({
  id: "child-meta",
  email: "child-meta@x.test",
  name: "child-meta",
  role: "child" as const,
}));

vi.mock("@/backend/shared/http/auth", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, requireAuthUser: async () => user, requireChildUser: async () => user };
});

vi.mock("@/backend/features/consent/consent.guard", () => ({
  assertChildConsented: async () => undefined,
  isChildConsentPending: async () => false,
}));

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("reply metadata", () => {
  it("names the offline persona when Claude is configured without a key", async () => {
    const { POST } = await import("@/app/api/conversation/route");
    const res = await POST(
      new Request("http://localhost/api/conversation?stream=1", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ message: "오늘 주사 맞아서 무서웠어" }),
      })
    );
    const events = (await res.text())
      .split("\n\n")
      .map((part) => part.replace(/^data: /, "").trim())
      .filter((p) => p && p !== "[DONE]")
      .map((p) => JSON.parse(p) as { type: string; reply?: { meta?: Record<string, unknown> } });
    const done = events.find((e) => e.type === "done");
    expect(done?.reply?.meta).toEqual({ provider: "mock", model: "mock-rules" });
  });
});
