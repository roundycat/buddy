import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The chat's safety writes must not depend on the child staying on the page:
 * guardian alert, signal log and the turn itself survive a disconnect. Also the
 * harm-by-someone route, the review window, declined turns and alert levels.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beddy-safety-flow-"));
process.env.BEDDY_DATA_DIR = dir;
process.env.PERSISTENCE = "json";
process.env.AUTH_PROVIDER = "json";
process.env.LLM_PROVIDER = "mock";
process.env.BEDDY_METRICS = "0";
process.env.AUTH_SESSION_SECRET = "flow-secret-flow-secret-flow-secret-123";
delete process.env.BEDROCK_KB_ID;

type Ctl = {
  user?: { id: string; email: string; name: string; role: "child" };
  /** Replace the companion stream with these chunks (with a pause between). */
  chunks?: string[];
  chunkDelayMs?: number;
  /** Histories the companion stream was called with. */
  histories: Array<Array<{ role: string; content: string }>>;
  /** Make the safety review run and answer this level after the delay. */
  review?: { level: string; delayMs: number };
};
const ctl: Ctl = { histories: [] };
(globalThis as Record<string, unknown>).__flowCtl = ctl;

vi.mock("@/backend/shared/http/auth", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  const current = () => ((globalThis as Record<string, unknown>).__flowCtl as Ctl).user;
  return { ...actual, requireAuthUser: async () => current(), requireChildUser: async () => current() };
});

// Consent has its own tests; here every child has it.
vi.mock("@/backend/features/consent/consent.guard", () => ({
  assertChildConsented: async () => undefined,
}));

vi.mock("@/backend/ai/orchestrator", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  const get = () => (globalThis as Record<string, unknown>).__flowCtl as Ctl;
  return {
    ...actual,
    streamCompanionChat: async function* (
      message: string,
      history: Array<{ role: string; content: string }>,
      ...rest: unknown[]
    ) {
      get().histories.push(history);
      const chunks = get().chunks;
      if (!chunks) {
        yield* (actual.streamCompanionChat as (...a: unknown[]) => AsyncIterable<string>)(
          message,
          history,
          ...rest
        );
        return;
      }
      for (const c of chunks) {
        yield c;
        await new Promise((r) => setTimeout(r, get().chunkDelayMs ?? 5));
      }
    },
  };
});

vi.mock("@/backend/ai/safety/v2/llm-review", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  const get = () => (globalThis as Record<string, unknown>).__flowCtl as Ctl;
  return {
    ...actual,
    // Short windows keep the test fast; the logic is the same.
    REVIEW_TIMEOUT_MS: 1000,
    REVIEW_GRACE_MS: 100,
    REVIEW_MIN_WINDOW_MS: 250,
    shouldReview: () => Boolean(get().review),
    reviewWithLlm: () => {
      const plan = get().review!;
      return new Promise((resolve) => setTimeout(() => resolve(plan.level), plan.delayMs));
    },
  };
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

beforeEach(() => {
  ctl.chunks = undefined;
  ctl.chunkDelayMs = undefined;
  ctl.review = undefined;
  ctl.histories = [];
});

function as(id: string) {
  ctl.user = { id, email: `${id}@x.test`, name: id, role: "child" };
}

function streamRequest(message: string) {
  return new Request("http://localhost/api/conversation?stream=1", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ message }),
  });
}

async function readEvents(res: Response): Promise<Array<Record<string, unknown>>> {
  const text = await res.text();
  return text
    .split("\n\n")
    .map((part) => part.replace(/^data: /, "").trim())
    .filter((p) => p && p !== "[DONE]")
    .map((p) => JSON.parse(p) as Record<string, unknown>);
}

async function waitFor<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms = 3000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const v = await read();
    if (ok(v) || Date.now() > until) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
}

async function stores() {
  const alerts = await import("@/backend/features/safety/safety-alert.store");
  const signals = await import("@/backend/ai/safety/v2/signal-log.store");
  const convo = await import("./conversation.store");
  return { alerts, signals, convo };
}

describe("the child leaves mid-reply", () => {
  it("after the help panel arrived: alert, signal and the partial turn are kept", async () => {
    as("child-left-after-panel");
    ctl.chunks = ["말해 줘서 고마워. ", "지금 ", "곁에 ", "있는 ", "어른에게 ", "알려 줘."];
    ctl.chunkDelayMs = 80;
    const { POST } = await import("@/app/api/conversation/route");
    const res = await POST(streamRequest("오늘 밤에 죽을 거야 진짜로"));
    const reader = res.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).toContain('"type":"crisis"');
    expect(first).toContain('"level":"urgent"');
    await reader.cancel();

    const { alerts, signals, convo } = await stores();
    const alert = await waitFor(
      () => alerts.getActiveChildSafetyAlert("child-left-after-panel"),
      (a) => Boolean(a)
    );
    expect(alert?.level).toBe("urgent");
    const log = await waitFor(
      () => signals.getSafetySignalLog("child-left-after-panel"),
      (l) => Boolean(l?.events.length)
    );
    expect(log?.events.map((e) => e.level)).toEqual(["urgent"]);
    const history = await waitFor(
      () => convo.getConversationHistory("child-left-after-panel"),
      (h) => h.length === 2
    );
    expect(history[0]).toMatchObject({ role: "user", content: "오늘 밤에 죽을 거야 진짜로" });
    expect(history[1]!.role).toBe("assistant");
    // The panel reached the child, so the saved reply is not padded.
    expect(history[1]!.content).not.toContain("알렸어");
  });

  it("before the panel arrived: the saved reply says what was shared", async () => {
    as("child-left-before-panel");
    ctl.chunks = ["응. ", "듣고 있어."];
    const { POST } = await import("@/app/api/conversation/route");
    const res = await POST(streamRequest("그냥 사라지고 싶어"));
    await res.body!.cancel();

    const { alerts, convo } = await stores();
    const alert = await waitFor(
      () => alerts.getActiveChildSafetyAlert("child-left-before-panel"),
      (a) => Boolean(a)
    );
    expect(alert?.level).toBe("elevated");
    const history = await waitFor(
      () => convo.getConversationHistory("child-left-before-panel"),
      (h) => h.length === 2
    );
    expect(history[1]!.content).toContain("보호자에게 '마음이 많이 힘들다'는 것만 알렸어");
  });
});

describe("harm by someone together with a death wish", () => {
  it("keeps the urgency, routes like protect, and sends nothing to the guardian", async () => {
    as("child-harmed");
    const { POST } = await import("@/app/api/conversation/route");
    const events = await readEvents(await POST(streamRequest("아빠가 때려서 죽고 싶어")));
    const panel = events.find((e) => e.type === "crisis") as {
      level: string;
      actions: Array<{ id: string }>;
      transparency: string;
    };
    expect(panel.level).toBe("elevated");
    const ids = panel.actions.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["notify_nurse", "social_worker", "police", "youth_counsel"]));
    expect(ids).not.toContain("notify_guardian");
    expect(panel.transparency).toContain("보호자에게 자동으로 보내지 않았어");

    const { alerts, signals } = await stores();
    const log = await waitFor(
      () => signals.getSafetySignalLog("child-harmed"),
      (l) => Boolean(l?.events.length)
    );
    expect(log?.events[0]?.categories).toContain("S6_abuse");
    expect(await alerts.getActiveChildSafetyAlert("child-harmed")).toBeNull();
  });
});

describe("the LLM review window", () => {
  it("a raise that arrives in time shows the panel after the reply and alerts once", async () => {
    as("child-review-in-time");
    ctl.review = { level: "elevated", delayMs: 40 };
    ctl.chunks = ["그랬구나. ", "더 말해 줄래?"];
    const { POST } = await import("@/app/api/conversation/route");
    const events = await readEvents(await POST(streamRequest("요즘 다 귀찮아")));
    const types = events.map((e) => e.type);
    expect(types.indexOf("crisis")).toBeGreaterThan(types.lastIndexOf("token"));
    expect(types.at(-1)).toBe("done");

    const { alerts, signals } = await stores();
    const alert = await waitFor(
      () => alerts.getActiveChildSafetyAlert("child-review-in-time"),
      (a) => Boolean(a)
    );
    expect(alert?.level).toBe("elevated");
    const log = await signals.getSafetySignalLog("child-review-in-time");
    expect(log?.events.map((e) => e.level)).toEqual(["elevated"]);
  });

  it("a raise after the window is dropped: no panel, no alert", async () => {
    as("child-review-late");
    ctl.review = { level: "elevated", delayMs: 700 };
    ctl.chunks = ["그랬구나."];
    const { POST } = await import("@/app/api/conversation/route");
    const events = await readEvents(await POST(streamRequest("요즘 다 귀찮아")));
    expect(events.some((e) => e.type === "crisis")).toBe(false);
    await new Promise((r) => setTimeout(r, 800));
    const { alerts } = await stores();
    expect(await alerts.getActiveChildSafetyAlert("child-review-late")).toBeNull();
  });

  it("a raise while the child is gone still alerts, and the saved reply says so", async () => {
    as("child-review-gone");
    ctl.review = { level: "elevated", delayMs: 120 };
    ctl.chunks = ["응. ", "그랬구나. ", "천천히 말해 줘."];
    ctl.chunkDelayMs = 60;
    const { POST } = await import("@/app/api/conversation/route");
    const res = await POST(streamRequest("요즘 다 귀찮아"));
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();

    const { alerts, convo } = await stores();
    const alert = await waitFor(
      () => alerts.getActiveChildSafetyAlert("child-review-gone"),
      (a) => Boolean(a)
    );
    expect(alert?.level).toBe("elevated");
    const history = await waitFor(
      () => convo.getConversationHistory("child-review-gone"),
      (h) => h.length === 2
    );
    expect(history[1]!.content).toContain("알렸어");
  });
});

describe("a declined turn", () => {
  it("is shown and saved, but kept out of the next turn's model context", async () => {
    as("child-declined");
    const { REFUSAL_FALLBACK_TEXT } = await import("@/backend/shared/llm/refusal");
    ctl.chunks = ["음... ", `\n\n${REFUSAL_FALLBACK_TEXT}`];
    const { POST } = await import("@/app/api/conversation/route");
    const first = await readEvents(await POST(streamRequest("이상한 질문 하나 해도 돼?")));
    const done = first.find((e) => e.type === "done") as { reply: { content: string } };
    expect(done.reply.content).toContain(REFUSAL_FALLBACK_TEXT);

    const { convo } = await stores();
    const history = await waitFor(
      () => convo.getConversationHistory("child-declined"),
      (h) => h.length === 2
    );
    expect(history.every((m) => m.meta?.refused)).toBe(true);

    ctl.chunks = ["좋아, 다른 이야기 하자."];
    await readEvents(await POST(streamRequest("그럼 오늘 점심 이야기 할래")));
    const sent = ctl.histories.at(-1)!;
    expect(sent.some((m) => m.content.includes("이상한 질문"))).toBe(false);
    expect(sent.some((m) => m.content.includes(REFUSAL_FALLBACK_TEXT))).toBe(false);
  });
});

describe("guardian alert level", () => {
  it("an open urgent alert is not replaced by a milder one", async () => {
    const { alerts } = await stores();
    await alerts.createChildSafetyAlert({ childUserId: "child-levels", summary: "u", level: "urgent" });
    await alerts.createChildSafetyAlert({ childUserId: "child-levels", summary: "e", level: "elevated" });
    const open = await alerts.getActiveChildSafetyAlert("child-levels");
    expect(open).toMatchObject({ level: "urgent", summary: "u" });
    expect(open?.lastSignalAt).toBeTruthy();

    await alerts.acknowledgeChildSafetyAlert("child-levels");
    await alerts.createChildSafetyAlert({ childUserId: "child-levels", summary: "e2", level: "elevated" });
    expect(await alerts.getActiveChildSafetyAlert("child-levels")).toMatchObject({ level: "elevated" });
  });
});
