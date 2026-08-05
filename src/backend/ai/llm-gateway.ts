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
} from "@/backend/shared/llm/types";
import {
  logObservation,
  newRequestId,
  observeAsync,
  putBeddyMetrics,
} from "@/backend/shared/observability";
import { StandardUnit } from "@aws-sdk/client-cloudwatch";

/**
 * LLM Gateway — model routing, Guardrails, instrumentation.
 * NOT a central decision layer: it never decides which component handles a request.
 * The caller supplies `feature` and `purpose`; this layer only maps and measures.
 */
export type AiPurpose = "chat" | "analysis" | "quality";

export function resolveModelForPurpose(purpose: AiPurpose): string {
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
 */
export async function runLlm(input: {
  feature: string;
  purpose: AiPurpose;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** default true when BEDROCK_GUARDRAIL_ID is set */
  applyGuardrail?: boolean;
}): Promise<LlmChatResult> {
  const model = resolveModelForPurpose(input.purpose);
  const guardrail =
    input.applyGuardrail === false ? false : defaultGuardrail();

  return observeAsync(
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
        model: env.llmProvider === "bedrock" ? model : undefined,
        guardrail,
      });
    }
  );
}

/** Child chat — Haiku (speed). Streaming immediate path + metrics. */
export async function* streamCompanionChat(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  companion?: CompanionPromptContext
): AsyncIterable<string> {
  const model = resolveModelForPurpose("chat");
  const requestId = newRequestId();
  const started = Date.now();
  let firstTokenMs: number | null = null;
  let success = true;
  let errorName: string | undefined;
  let message: string | undefined;

  try {
    for await (const token of streamWithCompanion(
      userMessage,
      history,
      companion,
      { model }
    )) {
      if (firstTokenMs === null) firstTokenMs = Date.now() - started;
      yield token;
    }
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
  companion?: CompanionPromptContext
): Promise<LlmChatResult> {
  const model = resolveModelForPurpose("chat");
  return observeAsync(
    {
      feature: "conversation.chat",
      operation: "chat",
      model,
      latencyMetric: "BedrockLatencyMs",
    },
    () =>
      chatWithCompanion(userMessage, history, companion, {
        model,
      })
  );
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
