import { env, isLlmConfigured } from "@/backend/shared/config/env";
import type { LlmChatRequest, LlmChatResult, LlmProvider } from "./types";
import { MockLlmProvider } from "./providers/mock.provider";
import { BedrockLlmProvider } from "./providers/bedrock.provider";
import {
  BEDI_CHAT_DEFAULTS,
  buildCompanionSystemPrompt,
  type CompanionPromptContext,
} from "@/backend/ai/prompts/companion";

let cached: LlmProvider | null = null;

/**
 * Resolve the active LLM provider from env.
 * Frontend never imports this — only backend services / API routes.
 */
export function getLlmProvider(): LlmProvider {
  if (cached) return cached;

  const provider = env.llmProvider;

  if (provider === "bedrock") {
    if (!isLlmConfigured("bedrock")) {
      console.warn("[llm] Bedrock 미설정 → mock으로 전환");
      cached = new MockLlmProvider();
      return cached;
    }
    cached = new BedrockLlmProvider();
    return cached;
  }

  cached = new MockLlmProvider();
  return cached;
}

/** Test helper / hot-reload safety */
export function resetLlmProviderCache() {
  cached = null;
}

function buildCompanionRequest(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  companion?: CompanionPromptContext,
  options?: { model?: string; systemAddendum?: string }
): LlmChatRequest {
  const recentHistory = history.slice(-24);
  const guardrail =
    env.llmProvider === "bedrock" && env.bedrock.guardrailId
      ? {
          guardrailIdentifier: env.bedrock.guardrailId,
          guardrailVersion: env.bedrock.guardrailVersion || "DRAFT",
        }
      : undefined;
  const baseSystem = buildCompanionSystemPrompt(companion);
  const system = options?.systemAddendum?.trim()
    ? `${baseSystem}\n\n${options.systemAddendum.trim()}`
    : baseSystem;
  return {
    messages: [
      {
        role: "system",
        content: system,
      },
      ...recentHistory.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: userMessage },
    ],
    temperature: BEDI_CHAT_DEFAULTS.temperature,
    maxTokens: BEDI_CHAT_DEFAULTS.maxTokens,
    ...(options?.model ? { model: options.model } : {}),
    ...(guardrail ? { guardrail } : {}),
  };
}

export async function chatWithCompanion(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  companion?: CompanionPromptContext,
  options?: { model?: string; systemAddendum?: string }
): Promise<LlmChatResult> {
  const provider = getLlmProvider();
  const request = buildCompanionRequest(
    userMessage,
    history,
    companion,
    options
  );

  try {
    return await provider.chat(request);
  } catch (error) {
    console.error(`[llm:${provider.name}]`, error);

    if (env.llmFallbackToMock && provider.name !== "mock") {
      console.warn("[llm] 실패 → mock fallback");
      return new MockLlmProvider().chat(request);
    }

    throw error;
  }
}

/** Stream companion reply tokens; falls back to one-shot chat if stream unsupported. */
export async function* streamWithCompanion(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  companion?: CompanionPromptContext,
  options?: { model?: string; systemAddendum?: string }
): AsyncIterable<string> {
  const provider = getLlmProvider();
  const request = buildCompanionRequest(
    userMessage,
    history,
    companion,
    options
  );

  try {
    if (provider.chatStream) {
      for await (const chunk of provider.chatStream(request)) {
        yield chunk;
      }
      return;
    }
    const result = await provider.chat(request);
    yield result.content;
  } catch (error) {
    console.error(`[llm:${provider.name}:stream]`, error);
    if (env.llmFallbackToMock && provider.name !== "mock") {
      console.warn("[llm] stream 실패 → mock fallback");
      for await (const chunk of new MockLlmProvider().chatStream!(request)) {
        yield chunk;
      }
      return;
    }
    throw error;
  }
}

export function getLlmStatus() {
  const provider = env.llmProvider;
  return {
    provider,
    configured: isLlmConfigured(provider),
    fallbackToMock: env.llmFallbackToMock,
    model:
      provider === "bedrock" ? env.bedrock.modelId : "mock-rules",
    chatModel:
      provider === "bedrock" ? env.bedrock.chatModelId : undefined,
    qualityModel:
      provider === "bedrock" ? env.bedrock.qualityModelId : undefined,
    bedrockRegion: provider === "bedrock" ? env.bedrock.region : undefined,
  };
}
