import { env, type AnthropicEffort } from "@/backend/shared/config/env";
import { recordCount } from "@/backend/shared/observability";
import type {
  LlmChatRequest,
  LlmChatResult,
  LlmMessage,
  LlmProvider,
  LlmPurpose,
  LlmToolChatRequest,
  LlmToolChatResult,
  LlmToolChoice,
  LlmToolUse,
} from "../types";

/**
 * Claude API (api.anthropic.com, Messages API) over fetch — for hosting outside AWS
 * (LLM_PROVIDER=anthropic). Same contract as the Bedrock provider.
 *
 * Model notes for Claude Haiku 5.5 (platform.claude.com docs, checked 2026-10-22):
 * - temperature / top_p / top_k return 400 → only sent to models that still accept them
 * - assistant prefill returns 400 → the conversation always ends with a user turn
 * - thinking is adaptive by default and `output_config.effort` controls it;
 *   `thinking: {type: "disabled"}` is accepted at effort low/medium/high
 * - thinking tokens count toward max_tokens, and the tokenizer counts ~30% more
 *   tokens than Haiku 4.5 for the same text → max_tokens gets headroom
 * - safety classifiers can end a turn with stop_reason "refusal" → child-safe text
 */

const API_VERSION = "2023-06-01";
const MAX_RETRIES = 2;

/** Shown to the child when the model declines (stop_reason "refusal"). */
export const REFUSAL_FALLBACK_TEXT =
  "그 이야기는 내가 도와주기 어려운 내용이야. 대신 다른 이야기를 같이 해 볼까? 혹시 마음이 힘들거나 무서운 일이 있으면 보호자나 간호사 선생님께 꼭 말해 줘.";

export class AnthropicApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorType: string,
    message: string
  ) {
    super(message);
    this.name = "AnthropicApiError";
  }
}

/** The model declined a non-chat request; callers fall back as on any failure. */
export class LlmRefusalError extends Error {
  constructor(readonly category?: string) {
    super(`Claude declined the request${category ? ` (${category})` : ""}`);
    this.name = "LlmRefusalError";
  }
}

type ThinkingParam = { type: "adaptive" } | { type: "disabled" } | { type: "between_tools" };

export interface ModelCaps {
  /** output_config.effort */
  effort: boolean;
  /** thinking: {type: "adaptive"} */
  adaptiveThinking: boolean;
  /** How to turn up-front thinking off, or null when it cannot be turned off / is off by default */
  thinkingOff: ThinkingParam | null;
  /** temperature / top_p / top_k still accepted */
  samplingParams: boolean;
}

/** Capabilities by model id. Defaults target claude-haiku-5-5. */
export function modelCaps(model: string): ModelCaps {
  const m = model.toLowerCase();
  const legacy = /claude-(haiku-4-5|sonnet-4-5|opus-4-5|opus-4-1|3-)/.test(m);
  if (legacy) {
    return {
      effort: /opus-4-5/.test(m),
      adaptiveThinking: false,
      thinkingOff: null,
      samplingParams: true,
    };
  }
  const v46 = /claude-(opus-4-6|sonnet-4-6)/.test(m);
  if (v46) {
    return {
      effort: true,
      adaptiveThinking: true,
      thinkingOff: { type: "disabled" },
      samplingParams: true,
    };
  }
  if (/claude-opus-5-5/.test(m)) {
    return { effort: true, adaptiveThinking: true, thinkingOff: null, samplingParams: false };
  }
  if (/claude-sonnet-5-5/.test(m)) {
    return {
      effort: true,
      adaptiveThinking: true,
      thinkingOff: { type: "between_tools" },
      samplingParams: false,
    };
  }
  // claude-haiku-5-5, claude-sonnet-5, claude-opus-5, 4.7/4.8 and later
  return {
    effort: true,
    adaptiveThinking: true,
    thinkingOff: { type: "disabled" },
    samplingParams: false,
  };
}

interface PurposeConfig {
  effort: AnthropicEffort;
  thinking: "adaptive" | "off";
}

export function purposeConfig(purpose: LlmPurpose | undefined): PurposeConfig {
  const a = env.anthropic;
  switch (purpose) {
    case "chat":
      return { effort: a.chatEffort, thinking: a.chatThinking === "disabled" ? "off" : "adaptive" };
    case "quality":
      return { effort: a.qualityEffort, thinking: "adaptive" };
    case "analysis":
    default:
      // Short JSON tasks and the safety review: fastest path.
      return { effort: a.analysisEffort, thinking: "off" };
  }
}

/** max_tokens with room for the newer tokenizer and (adaptive) thinking. */
export function maxTokensFor(
  requested: number,
  thinking: "adaptive" | "off",
  effort: AnthropicEffort
): number {
  const base = Math.ceil(requested * 1.35);
  if (thinking !== "adaptive") return base;
  const headroom = effort === "low" ? 2048 : effort === "medium" ? 6144 : 12288;
  return base + headroom;
}

type ApiTextMessage = { role: "user" | "assistant"; content: string };

/**
 * user/assistant only, non-empty, consecutive same-role turns merged, starts and
 * ends with a user turn (current models reject assistant prefill).
 */
export function toApiMessages(messages: LlmMessage[]): ApiTextMessage[] {
  const out: ApiTextMessage[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const text = typeof m.content === "string" ? m.content : "";
    if (!text.trim()) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n\n${text}`;
    else out.push({ role: m.role, content: text });
  }
  if (!out.length) {
    throw new Error("Claude API에 전달할 user/assistant 메시지가 없습니다.");
  }
  if (out[0]!.role === "assistant") {
    out.unshift({ role: "user", content: "(이전 대화에 이어서 이야기해요)" });
  }
  if (out[out.length - 1]!.role === "assistant") {
    const tail = out.pop()!;
    const note = `직전 답변이 여기서 끝났어요:\n${tail.content}\n이어서 답해 주세요.`;
    const last = out[out.length - 1];
    if (last && last.role === "user") last.content = `${last.content}\n\n${note}`;
    else out.push({ role: "user", content: note });
  }
  return out;
}

function systemText(messages: LlmMessage[]): string {
  return messages
    .filter((m) => m.role === "system" && m.content?.trim())
    .map((m) => m.content.trim())
    .join("\n\n");
}

function systemBlocks(text: string) {
  if (!text) return undefined;
  // Long, stable system prompt → prompt cache (ignored when below the minimum size).
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

function generationParams(
  model: string,
  cfg: PurposeConfig,
  requestedMaxTokens: number,
  temperature?: number
) {
  const caps = modelCaps(model);
  const params: Record<string, unknown> = {};
  let thinkingMode: "adaptive" | "off" = "off";

  if (caps.adaptiveThinking) {
    if (cfg.thinking === "adaptive") {
      params.thinking = { type: "adaptive" };
      thinkingMode = "adaptive";
    } else if (caps.thinkingOff) {
      params.thinking = caps.thinkingOff;
    } else {
      thinkingMode = "adaptive"; // cannot be turned off (e.g. Opus 5.5)
    }
  }
  if (caps.effort) params.output_config = { effort: cfg.effort };
  if (caps.samplingParams && typeof temperature === "number") {
    params.temperature = temperature;
  }
  params.max_tokens = maxTokensFor(requestedMaxTokens, thinkingMode, cfg.effort);
  return params;
}

export function buildChatBody(request: LlmChatRequest, stream: boolean) {
  const model =
    request.model?.trim() ||
    (request.purpose === "quality" ? env.anthropic.qualityModel : env.anthropic.chatModel);
  const cfg = purposeConfig(request.purpose);
  const system = systemBlocks(systemText(request.messages));
  return {
    model,
    ...generationParams(model, cfg, request.maxTokens ?? 400, request.temperature),
    ...(system ? { system } : {}),
    messages: toApiMessages(request.messages),
    ...(stream ? { stream: true } : {}),
  };
}

type ApiContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

type ApiMessage = { role: "user" | "assistant"; content: ApiContentBlock[] };

function toolChoiceParam(choice: LlmToolChoice | undefined) {
  if (!choice || choice === "auto") return { type: "auto" };
  if (choice === "any") return { type: "any" };
  return { type: "tool", name: choice.name };
}

function stringifyToolContent(content: unknown): string {
  if (typeof content === "string") return content || "(empty)";
  try {
    return JSON.stringify(content ?? null);
  } catch {
    return String(content);
  }
}

export function buildToolBody(request: LlmToolChatRequest) {
  const model =
    request.model?.trim() ||
    (request.purpose === "quality" ? env.anthropic.qualityModel : env.anthropic.chatModel);
  // Thinking blocks would have to be replayed with each tool result; this
  // contract does not carry them, so tool turns always run without thinking.
  const cfg: PurposeConfig = {
    effort: request.purpose === "quality" ? env.anthropic.qualityEffort : env.anthropic.analysisEffort,
    thinking: "off",
  };

  const messages: ApiMessage[] = [];
  const push = (role: ApiMessage["role"], blocks: ApiContentBlock[]) => {
    if (!blocks.length) return;
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else messages.push({ role, content: blocks });
  };

  for (const turn of request.turns) {
    if (turn.role === "toolResult") {
      push(
        "user",
        turn.results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.toolUseId,
          content: stringifyToolContent(r.content),
          ...(r.isError ? { is_error: true } : {}),
        }))
      );
    } else if (turn.role === "assistant") {
      const blocks: ApiContentBlock[] = [];
      if (turn.text?.trim()) blocks.push({ type: "text", text: turn.text });
      for (const use of turn.toolUses ?? []) {
        blocks.push({ type: "tool_use", id: use.toolUseId, name: use.name, input: use.input ?? {} });
      }
      push("assistant", blocks);
    } else if (turn.text?.trim()) {
      push("user", [{ type: "text", text: turn.text }]);
    }
  }
  if (!messages.length || messages[0]!.role !== "user") {
    messages.unshift({ role: "user", content: [{ type: "text", text: "(시작)" }] });
  }
  if (messages[messages.length - 1]!.role !== "user") {
    messages.push({ role: "user", content: [{ type: "text", text: "이어서 진행해 주세요." }] });
  }

  const tools =
    request.tools.length > 0
      ? request.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema,
        }))
      : undefined;
  const system = systemBlocks(request.system?.trim() ?? "");

  return {
    model,
    ...generationParams(model, cfg, request.maxTokens ?? 600, request.temperature),
    ...(system ? { system } : {}),
    messages,
    ...(tools
      ? {
          tools,
          tool_choice: request.disableTools ? { type: "none" } : toolChoiceParam(request.toolChoice),
        }
      : {}),
  };
}

function retryable(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  const fromHeader = retryAfter ? Number(retryAfter) * 1000 : NaN;
  if (Number.isFinite(fromHeader) && fromHeader > 0) return Math.min(fromHeader, 8000);
  return Math.min(500 * 2 ** attempt + Math.floor(Math.random() * 250), 8000);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readError(res: Response): Promise<AnthropicApiError> {
  let type = "api_error";
  let message = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { error?: { type?: string; message?: string } };
    if (body?.error?.type) type = body.error.type;
    if (body?.error?.message) message = body.error.message.slice(0, 300);
  } catch {
    /* non-JSON error body */
  }
  return new AnthropicApiError(res.status, type, `Claude API ${res.status} ${type}: ${message}`);
}

type ApiResponse = {
  content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  stop_reason?: string | null;
  stop_details?: { category?: string } | null;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
};

function usageOf(u: ApiResponse["usage"]) {
  if (!u) return undefined;
  return {
    inputTokens:
      (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    outputTokens: u.output_tokens,
  };
}

export class AnthropicLlmProvider implements LlmProvider {
  readonly name = "anthropic";

  private async post(body: unknown, signal?: AbortSignal): Promise<Response> {
    const { apiKey, baseUrl } = env.anthropic;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    let attempt = 0;
    for (;;) {
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": API_VERSION,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
          signal,
        });
      } catch (error) {
        if (signal?.aborted || attempt >= MAX_RETRIES) throw error;
        await sleep(backoffMs(attempt, null));
        attempt += 1;
        continue;
      }
      if (res.ok) return res;
      if (retryable(res.status) && attempt < MAX_RETRIES) {
        const wait = backoffMs(attempt, res.headers.get("retry-after"));
        await res.body?.cancel().catch(() => undefined);
        await sleep(wait);
        attempt += 1;
        continue;
      }
      throw await readError(res);
    }
  }

  private async create(body: Record<string, unknown>): Promise<ApiResponse> {
    const signal = AbortSignal.timeout(env.anthropic.timeoutMs);
    const res = await this.post(body, signal);
    return (await res.json()) as ApiResponse;
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResult> {
    const body = buildChatBody(request, false);
    const data = await this.create(body);
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();

    if (data.stop_reason === "refusal") {
      recordCount("LlmRefusals", 1, { feature: request.purpose ?? "analysis", operation: "chat" });
      if (request.purpose !== "chat") throw new LlmRefusalError(data.stop_details?.category);
      return {
        content: REFUSAL_FALLBACK_TEXT,
        provider: this.name,
        model: body.model,
        usage: usageOf(data.usage),
      };
    }
    if (!text) throw new Error(`Claude API 응답에 text가 없습니다 (stop_reason=${data.stop_reason}).`);

    return {
      content: text,
      provider: this.name,
      model: body.model,
      usage: usageOf(data.usage),
    };
  }

  async *chatStream(request: LlmChatRequest): AsyncIterable<string> {
    const body = buildChatBody(request, true);
    let attempt = 0;
    for (;;) {
      let yielded = false;
      let stopReason: string | null = null;
      try {
        // Time limit until the response starts; readSse then guards idle gaps.
        const controller = new AbortController();
        const startTimer = setTimeout(() => controller.abort(), env.anthropic.timeoutMs);
        let res: Response;
        try {
          res = await this.post(body, controller.signal);
        } finally {
          clearTimeout(startTimer);
        }
        for await (const event of readSse(res, env.anthropic.timeoutMs)) {
          const type = event.type;
          if (type === "content_block_delta") {
            const delta = event.delta as { type?: string; text?: string } | undefined;
            if (delta?.type === "text_delta" && delta.text) {
              yielded = true;
              yield delta.text;
            }
          } else if (type === "message_delta") {
            const d = event.delta as { stop_reason?: string | null } | undefined;
            if (d?.stop_reason) stopReason = d.stop_reason;
          } else if (type === "error") {
            const err = event.error as { type?: string; message?: string } | undefined;
            throw new AnthropicApiError(
              err?.type === "overloaded_error" ? 529 : 500,
              err?.type ?? "api_error",
              `Claude API stream error: ${err?.message ?? "unknown"}`
            );
          }
        }
      } catch (error) {
        const retry =
          !yielded &&
          attempt < MAX_RETRIES &&
          (!(error instanceof AnthropicApiError) || retryable(error.status));
        if (!retry) throw error;
        await sleep(backoffMs(attempt, null));
        attempt += 1;
        continue;
      }

      if (stopReason === "refusal") {
        recordCount("LlmRefusals", 1, { feature: "chat", operation: "stream" });
        yield yielded ? `\n\n${REFUSAL_FALLBACK_TEXT}` : REFUSAL_FALLBACK_TEXT;
        return;
      }
      if (!yielded) throw new Error(`Claude API 스트림에 text가 없습니다 (stop_reason=${stopReason}).`);
      return;
    }
  }

  async chatWithTools(request: LlmToolChatRequest): Promise<LlmToolChatResult> {
    const body = buildToolBody(request);
    const data = await this.create(body);
    const blocks = data.content ?? [];
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
    const toolUses: LlmToolUse[] = [];
    for (const b of blocks) {
      if (b.type !== "tool_use" || !b.id || !b.name) continue;
      toolUses.push({
        toolUseId: b.id,
        name: b.name,
        input:
          b.input && typeof b.input === "object" && !Array.isArray(b.input)
            ? (b.input as Record<string, unknown>)
            : {},
      });
    }
    if (data.stop_reason === "refusal") {
      recordCount("LlmRefusals", 1, { feature: request.purpose ?? "analysis", operation: "tool_use" });
    }
    return {
      text,
      toolUses,
      stopReason: data.stop_reason ?? "end_turn",
      provider: this.name,
      model: String(body.model),
      usage: usageOf(data.usage),
    };
  }
}

/**
 * Server-sent events from the Messages API. `idleMs` aborts a stalled stream.
 * Yields each event's JSON payload (which carries its own `type`).
 */
export async function* readSse(
  res: Response,
  idleMs: number
): AsyncGenerator<Record<string, unknown>> {
  if (!res.body) throw new Error("Claude API 스트림이 비어 있습니다.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const readWithTimeout = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Claude API 스트림 응답이 멈췄습니다.")), idleMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  try {
    for (;;) {
      const { done, value } = await readWithTimeout();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const data = raw
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          if (parsed && typeof parsed === "object") yield parsed;
        } catch {
          /* ignore malformed keep-alive lines */
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
