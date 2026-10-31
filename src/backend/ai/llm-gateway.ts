import "server-only";
import { env } from "@/backend/shared/config/env";
import {
  chatWithCompanion,
  getLlmProvider,
  streamWithCompanion,
} from "@/backend/shared/llm";
import type { CompanionPromptContext } from "@/backend/ai/prompts/companion";
import type {
  LlmChatRequest,
  LlmChatResult,
  LlmMessage,
  LlmToolChatResult,
  LlmToolChoice,
  LlmToolSpec,
  LlmToolTurn,
} from "@/backend/shared/llm/types";
import {
  logObservation,
  newRequestId,
  observeAsync,
  putBeddyMetrics,
  recordCount,
} from "@/backend/shared/observability";
import { guardChildFacingOutput } from "@/backend/ai/safety/v2/output-guard";
import {
  createStreamingNameFilter,
  fillNamePlaceholders,
} from "@/backend/shared/llm/sanitize";
import { StandardUnit } from "@aws-sdk/client-cloudwatch";

/**
 * LLM Gateway — model routing, Guardrails, instrumentation.
 * NOT a central decision layer: it never decides which component handles a request.
 * The caller supplies `feature` and `purpose`; this layer only maps and measures.
 */
export type AiPurpose = "chat" | "analysis" | "quality";

export function resolveModelForPurpose(purpose: AiPurpose): string {
  if (env.llmProvider === "anthropic") {
    return purpose === "quality"
      ? env.anthropic.qualityModel
      : env.anthropic.chatModel;
  }
  if (env.llmProvider !== "bedrock") return "mock-rules";

  switch (purpose) {
    case "chat":
    case "analysis":
      return env.bedrock.chatModelId;
    case "quality":
      return env.bedrock.qualityModelId;
    default:
      return env.bedrock.chatModelId;
  }
}

function defaultGuardrail(): LlmChatRequest["guardrail"] {
  if (!env.bedrock.guardrailId) return undefined;
  return {
    guardrailIdentifier: env.bedrock.guardrailId,
    guardrailVersion: env.bedrock.guardrailVersion || "DRAFT",
  };
}

/**
 * Generic LLM call — all non-stream feature paths should use this.
 *
 * Output always goes through `fillNamePlaceholders`, so a `{NAME}` the model
 * invented can never reach a screen. Pass `childName` to get the real name
 * (with the right 조사) instead of the placeholder simply being dropped.
 */
export async function runLlm(input: {
  feature: string;
  purpose: AiPurpose;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** default true when BEDROCK_GUARDRAIL_ID is set */
  applyGuardrail?: boolean;
  /** The child's name, used to resolve `{NAME}` placeholders in the answer */
  childName?: string;
  /**
   * The answer is shown to a child: it passes the same output filter as the chat
   * reply (personal data, medication and method instructions, secrecy).
   */
  childFacing?: boolean;
}): Promise<LlmChatResult> {
  const model = resolveModelForPurpose(input.purpose);
  const guardrail =
    input.applyGuardrail === false ? false : defaultGuardrail();

  const result = await observeAsync(
    {
      feature: input.feature,
      operation: "chat",
      model,
      latencyMetric: "BedrockLatencyMs",
    },
    async () => {
      const provider = getLlmProvider();
      return provider.chat({
        messages: input.messages,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        purpose: input.purpose,
        model: env.llmProvider !== "mock" ? model : undefined,
        guardrail,
      });
    }
  );

  const content = fillNamePlaceholders(result.content, input.childName);
  if (!input.childFacing) return { ...result, content };
  const guarded = guardChildFacingOutput(content);
  if (guarded.flags.length) {
    recordCount("OutputGuard", 1, {
      feature: input.feature,
      operation: guarded.flags.slice().sort().join(","),
    });
  }
  return { ...result, content: guarded.text };
}

/** Raised when the active provider has no tool-use API (e.g. mock). */
export class ToolUseUnsupportedError extends Error {
  constructor(providerName: string) {
    super(`Provider "${providerName}" does not support tool use.`);
    this.name = "ToolUseUnsupportedError";
  }
}

/**
 * Tool-use LLM turn — the model picks which tool to call.
 * Same routing, Guardrails and instrumentation as runLlm().
 */
export async function runLlmWithTools(input: {
  feature: string;
  purpose: AiPurpose;
  system?: string;
  turns: LlmToolTurn[];
  tools: LlmToolSpec[];
  temperature?: number;
  maxTokens?: number;
  applyGuardrail?: boolean;
  /** The child's name, used to resolve `{NAME}` placeholders in the answer */
  childName?: string;
  disableTools?: boolean;
  toolChoice?: LlmToolChoice;
}): Promise<LlmToolChatResult> {
  const model = resolveModelForPurpose(input.purpose);
  const guardrail =
    input.applyGuardrail === false ? false : defaultGuardrail();

  const result = await observeAsync(
    {
      feature: input.feature,
      operation: "tool_use",
      model,
      latencyMetric: "BedrockLatencyMs",
    },
    async () => {
      const provider = getLlmProvider();
      if (!provider.chatWithTools) {
        throw new ToolUseUnsupportedError(provider.name);
      }
      return provider.chatWithTools({
        system: input.system,
        turns: input.turns,
        tools: input.tools,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        purpose: input.purpose,
        model: env.llmProvider !== "mock" ? model : undefined,
        guardrail,
        disableTools: input.disableTools,
        toolChoice: input.toolChoice,
      });
    }
  );

  return {
    ...result,
    text: fillNamePlaceholders(result.text, input.childName),
  };
}

/** Child chat — Haiku (speed). Streaming immediate path + metrics. */
export async function* streamCompanionChat(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  companion?: CompanionPromptContext,
  options?: { systemAddendum?: string; onProvider?: (name: string) => void }
): AsyncIterable<string> {
  const model = resolveModelForPurpose("chat");
  const requestId = newRequestId();
  const started = Date.now();
  let firstTokenMs: number | null = null;
  let success = true;
  let errorName: string | undefined;
  let message: string | undefined;

  // A placeholder can straddle two tokens, so filter the assembled stream.
  const nameFilter = createStreamingNameFilter(companion?.childName);

  try {
    for await (const token of streamWithCompanion(
      userMessage,
      history,
      companion,
      { model, systemAddendum: options?.systemAddendum, onProvider: options?.onProvider }
    )) {
      if (firstTokenMs === null) firstTokenMs = Date.now() - started;
      const safe = nameFilter.push(token);
      if (safe) yield safe;
    }
    const tail = nameFilter.flush();
    if (tail) yield tail;
  } catch (error) {
    success = false;
    errorName = error instanceof Error ? error.name : "UnknownError";
    message =
      error instanceof Error ? error.message.slice(0, 240) : String(error);
    throw error;
  } finally {
    const latencyMs = Date.now() - started;
    logObservation({
      feature: "conversation.chat",
      operation: "stream",
      model,
      latencyMs,
      success,
      requestId,
      errorName,
      message,
    });
    putBeddyMetrics([
      {
        name: "BedrockLatencyMs",
        value: latencyMs,
        unit: StandardUnit.Milliseconds,
        feature: "conversation.chat",
        model,
        operation: "stream",
      },
      ...(firstTokenMs != null
        ? [
            {
              name: "BedrockFirstTokenMs",
              value: firstTokenMs,
              unit: StandardUnit.Milliseconds,
              feature: "conversation.chat",
              model,
              operation: "stream",
            },
          ]
        : []),
      {
        name: "Invocations",
        value: 1,
        unit: StandardUnit.Count,
        feature: "conversation.chat",
        model,
        operation: "stream",
      },
      ...(!success
        ? [
            {
              name: "Errors",
              value: 1,
              unit: StandardUnit.Count,
              feature: "conversation.chat",
              model,
              operation: "stream",
            },
          ]
        : []),
    ]);
  }
}

/** Child chat one-shot (non-SSE). */
export async function companionChat(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  companion?: CompanionPromptContext,
  options?: { systemAddendum?: string }
): Promise<LlmChatResult> {
  const model = resolveModelForPurpose("chat");
  const result = await observeAsync(
    {
      feature: "conversation.chat",
      operation: "chat",
      model,
      latencyMetric: "BedrockLatencyMs",
    },
    () =>
      chatWithCompanion(userMessage, history, companion, {
        model,
        systemAddendum: options?.systemAddendum,
      })
  );

  return {
    ...result,
    content: fillNamePlaceholders(result.content, companion?.childName),
  };
}

export async function observeBatchRun<T>(
  feature: string,
  fn: () => Promise<T>
): Promise<T> {
  return observeAsync(
    {
      feature,
      operation: "batch",
      model: resolveModelForPurpose("quality"),
      latencyMetric: "BatchLatencyMs",
    },
    fn
  );
}

export async function observeKbSearch<T>(
  feature: string,
  fn: () => Promise<T>
): Promise<T> {
  return observeAsync(
    {
      feature,
      operation: "kb_search",
      latencyMetric: "KbSearchLatencyMs",
    },
    fn
  );
}
