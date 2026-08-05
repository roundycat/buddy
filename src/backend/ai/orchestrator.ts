import "server-only";
import { env } from "@/backend/shared/config/env";
import {
  chatWithCompanion,
  streamWithCompanion,
} from "@/backend/shared/llm";
import type { CompanionPromptContext } from "@/backend/shared/llm/prompts/companion";
import type { LlmChatResult } from "@/backend/shared/llm/types";

/**
 * AI Orchestrator — single entry for model routing.
 * STEP 1: chat path only. Other features migrate later.
 */
export type AiPurpose = "chat" | "analysis" | "quality";

export function resolveModelForPurpose(purpose: AiPurpose): string {
  if (env.llmProvider === "openai") return env.openai.model;
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

/** Child chat — Haiku (speed). Streaming immediate path. */
export async function* streamCompanionChat(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  companion?: CompanionPromptContext
): AsyncIterable<string> {
  yield* streamWithCompanion(userMessage, history, companion, {
    model: resolveModelForPurpose("chat"),
  });
}

/** Child chat one-shot (non-SSE). */
export async function companionChat(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  companion?: CompanionPromptContext
): Promise<LlmChatResult> {
  return chatWithCompanion(userMessage, history, companion, {
    model: resolveModelForPurpose("chat"),
  });
}
