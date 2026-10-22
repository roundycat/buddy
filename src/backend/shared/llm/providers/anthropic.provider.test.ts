import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Claude API provider against a local fake of the Messages API
 * (request shape, SSE parsing, retries, refusals, tool use).
 */

type Captured = { headers: http.IncomingHttpHeaders; body: Record<string, unknown> };
type Reply = (req: Captured, res: http.ServerResponse) => void;

let server: http.Server;
let replies: Reply[] = [];
let captured: Captured[] = [];
let mod: typeof import("./anthropic.provider");

function json(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function sse(res: http.ServerResponse, events: unknown[], chunkSplit = 7) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  const text = events
    .map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`)
    .join("");
  // Deliberately cut the stream into small pieces, including mid-event and mid-UTF-8.
  const bytes = Buffer.from(text, "utf8");
  let i = 0;
  const pump = () => {
    if (i >= bytes.length) return res.end();
    res.write(bytes.subarray(i, i + chunkSplit));
    i += chunkSplit;
    setImmediate(pump);
  };
  pump();
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const cap = { headers: req.headers, body: JSON.parse(raw || "{}") };
      captured.push(cap);
      const reply = replies.shift();
      if (!reply) return json(res, 500, { type: "error", error: { type: "api_error", message: "no reply queued" } });
      reply(cap, res);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const { port } = server.address() as AddressInfo;
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.ANTHROPIC_TIMEOUT_MS = "5000";
  mod = await import("./anthropic.provider");
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

beforeEach(() => {
  replies = [];
  captured = [];
});

describe("request body", () => {
  it("child chat on Haiku 5.5: no sampling params, adaptive thinking, low effort, user-first/last", () => {
    const body = mod.buildChatBody(
      {
        purpose: "chat",
        temperature: 0.9,
        maxTokens: 700,
        messages: [
          { role: "system", content: "SYSTEM A" },
          { role: "system", content: "SYSTEM B" },
          { role: "assistant", content: "안녕! 나는 베디야." },
          { role: "user", content: "안녕" },
          { role: "user", content: "오늘 심심해" },
        ],
      },
      false
    ) as Record<string, unknown>;
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.temperature).toBeUndefined();
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "low" });
    expect(body.max_tokens).toBe(Math.ceil(700 * 1.35) + 2048);
    expect(body.system).toEqual([{ type: "text", text: "SYSTEM A\n\nSYSTEM B", cache_control: { type: "ephemeral" } }]);
    expect(body.messages).toEqual([
      { role: "user", content: "(이전 대화에 이어서 이야기해요)" },
      { role: "assistant", content: "안녕! 나는 베디야." },
      { role: "user", content: "안녕\n\n오늘 심심해" },
    ]);
  });

  it("analysis turns thinking off; a trailing assistant turn becomes a user note", () => {
    const body = mod.buildChatBody(
      {
        purpose: "analysis",
        maxTokens: 80,
        messages: [
          { role: "user", content: "분류해 줘" },
          { role: "assistant", content: "{" },
        ],
      },
      false
    ) as unknown as { thinking: unknown; messages: Array<{ role: string; content: string }>; max_tokens: number };
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.max_tokens).toBe(108);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]!.role).toBe("user");
    expect(body.messages[0]!.content).toContain("직전 답변이 여기서 끝났어요");
  });

  it("legacy Haiku 4.5 keeps temperature and sends no thinking/effort", () => {
    const body = mod.buildChatBody(
      { model: "claude-haiku-4-5", temperature: 0.2, messages: [{ role: "user", content: "hi" }] },
      false
    ) as Record<string, unknown>;
    expect(body.temperature).toBe(0.2);
    expect(body.thinking).toBeUndefined();
    expect(body.output_config).toBeUndefined();
  });
});

describe("chat()", () => {
  it("reads text blocks only and maps usage; sends auth headers", async () => {
    replies.push((_req, res) =>
      json(res, 200, {
        content: [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "text", text: "반가워!" },
          { type: "text", text: " 오늘 뭐 했어?" },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 90 },
      })
    );
    const p = new mod.AnthropicLlmProvider();
    const r = await p.chat({ purpose: "chat", messages: [{ role: "user", content: "안녕" }] });
    expect(r.content).toBe("반가워! 오늘 뭐 했어?");
    expect(r.usage).toEqual({ inputTokens: 100, outputTokens: 5 });
    expect(captured[0]!.headers["x-api-key"]).toBe("test-key");
    expect(captured[0]!.headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("retries 529 overloaded, then succeeds", async () => {
    replies.push((_req, res) =>
      json(res, 529, { type: "error", error: { type: "overloaded_error", message: "busy" } }, { "retry-after": "0" })
    );
    replies.push((_req, res) => json(res, 200, { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }));
    const r = await new mod.AnthropicLlmProvider().chat({ messages: [{ role: "user", content: "x" }] });
    expect(r.content).toBe("ok");
    expect(captured).toHaveLength(2);
  });

  it("does not retry a 400 and reports the error type", async () => {
    replies.push((_req, res) =>
      json(res, 400, { type: "error", error: { type: "invalid_request_error", message: "bad field" } })
    );
    await expect(
      new mod.AnthropicLlmProvider().chat({ messages: [{ role: "user", content: "x" }] })
    ).rejects.toMatchObject({ name: "AnthropicApiError", status: 400, errorType: "invalid_request_error" });
    expect(captured).toHaveLength(1);
  });

  it("refusal: child chat gets the safe fallback, other purposes throw", async () => {
    const refusal: Reply = (_req, res) =>
      json(res, 200, { content: [], stop_reason: "refusal", stop_details: { category: "general_harms" } });
    replies.push(refusal, refusal);
    const p = new mod.AnthropicLlmProvider();
    const chat = await p.chat({ purpose: "chat", messages: [{ role: "user", content: "x" }] });
    expect(chat.content).toBe(mod.REFUSAL_FALLBACK_TEXT);
    await expect(p.chat({ purpose: "analysis", messages: [{ role: "user", content: "x" }] })).rejects.toBeInstanceOf(
      mod.LlmRefusalError
    );
  });
});

describe("chatStream()", () => {
  const start = { type: "message_start", message: { id: "m", content: [], usage: { input_tokens: 3 } } };
  const blockStart = (index: number, type: string) => ({
    type: "content_block_start",
    index,
    content_block: type === "text" ? { type: "text", text: "" } : { type, thinking: "" },
  });
  const textDelta = (index: number, text: string) => ({
    type: "content_block_delta",
    index,
    delta: { type: "text_delta", text },
  });

  it("yields text deltas across split chunks and ignores thinking", async () => {
    replies.push((_req, res) =>
      sse(res, [
        start,
        blockStart(0, "thinking"),
        { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "..." } },
        { type: "content_block_stop", index: 0 },
        blockStart(1, "text"),
        { type: "ping" },
        textDelta(1, "오늘은 "),
        textDelta(1, "기분이 어때? 😊"),
        { type: "content_block_stop", index: 1 },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 9 } },
        { type: "message_stop" },
      ])
    );
    const out: string[] = [];
    for await (const t of new mod.AnthropicLlmProvider().chatStream({
      purpose: "chat",
      messages: [{ role: "user", content: "안녕" }],
    })) {
      out.push(t);
    }
    expect(out.join("")).toBe("오늘은 기분이 어때? 😊");
    expect(captured[0]!.body.stream).toBe(true);
  });

  it("appends the fallback after a refusal mid-stream", async () => {
    replies.push((_req, res) =>
      sse(res, [
        start,
        blockStart(0, "text"),
        textDelta(0, "음,"),
        { type: "message_delta", delta: { stop_reason: "refusal" } },
        { type: "message_stop" },
      ])
    );
    const out: string[] = [];
    for await (const t of new mod.AnthropicLlmProvider().chatStream({
      purpose: "chat",
      messages: [{ role: "user", content: "x" }],
    })) {
      out.push(t);
    }
    expect(out.join("")).toBe(`음,\n\n${mod.REFUSAL_FALLBACK_TEXT}`);
  });

  it("retries when the stream errors before any text", async () => {
    replies.push((_req, res) => sse(res, [start, { type: "error", error: { type: "overloaded_error", message: "x" } }]));
    replies.push((_req, res) =>
      sse(res, [start, blockStart(0, "text"), textDelta(0, "다시 왔어"), { type: "message_stop" }])
    );
    const out: string[] = [];
    for await (const t of new mod.AnthropicLlmProvider().chatStream({
      purpose: "chat",
      messages: [{ role: "user", content: "x" }],
    })) {
      out.push(t);
    }
    expect(out.join("")).toBe("다시 왔어");
    expect(captured).toHaveLength(2);
  });
});

describe("chatWithTools()", () => {
  it("maps turns, tools and tool_choice; parses tool_use blocks", async () => {
    replies.push((_req, res) =>
      json(res, 200, {
        content: [
          { type: "text", text: "미션을 만들게." },
          { type: "tool_use", id: "tu_2", name: "save_missions", input: { count: 3 } },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 50, output_tokens: 20 },
      })
    );
    const r = await new mod.AnthropicLlmProvider().chatWithTools({
      system: "planner",
      purpose: "quality",
      tools: [
        { name: "get_profile", description: "profile", inputSchema: { type: "object", properties: {} } },
        { name: "save_missions", description: "save", inputSchema: { type: "object", properties: {} } },
      ],
      toolChoice: "any",
      turns: [
        { role: "user", text: "오늘 미션" },
        { role: "assistant", toolUses: [{ toolUseId: "tu_1", name: "get_profile", input: {} }] },
        { role: "toolResult", results: [{ toolUseId: "tu_1", content: { name: "하늘" } }] },
      ],
    });
    expect(r.toolUses).toEqual([{ toolUseId: "tu_2", name: "save_missions", input: { count: 3 } }]);
    expect(r.stopReason).toBe("tool_use");
    const body = captured[0]!.body as {
      tool_choice: unknown;
      thinking: unknown;
      output_config: unknown;
      tools: Array<{ name: string; input_schema: unknown }>;
      messages: Array<{ role: string; content: Array<Record<string, unknown>> }>;
    };
    expect(body.tool_choice).toEqual({ type: "any" });
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.output_config).toEqual({ effort: "medium" });
    expect(body.tools.map((t) => t.name)).toEqual(["get_profile", "save_missions"]);
    expect(body.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(body.messages[2]!.content[0]).toEqual({
      type: "tool_result",
      tool_use_id: "tu_1",
      content: JSON.stringify({ name: "하늘" }),
    });
  });

  it("disableTools keeps the catalogue but sets tool_choice none", () => {
    const body = mod.buildToolBody({
      tools: [{ name: "a", description: "a", inputSchema: { type: "object" } }],
      disableTools: true,
      turns: [{ role: "user", text: "끝" }],
    }) as unknown as { tool_choice: unknown };
    expect(body.tool_choice).toEqual({ type: "none" });
  });
});
