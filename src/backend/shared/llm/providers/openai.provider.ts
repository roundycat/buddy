import { env } from "@/backend/shared/config/env";
import { fetchJson, HttpError } from "@/backend/shared/http/fetch-json";
import type { LlmChatRequest, LlmChatResult, LlmProvider } from "../types";

interface OpenAiChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
}

/**
 * OpenAI Chat Completions API (also works with compatible gateways:
 * Azure OpenAI, OpenRouter, Groq, Ollama `/v1`, etc. via OPENAI_BASE_URL).
 */
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = "openai";

  async chat(request: LlmChatRequest): Promise<LlmChatResult> {
    const { apiKey, baseUrl, model } = env.openai;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }

    try {
      const data = await fetchJson<OpenAiChatCompletionResponse>(
        `${baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 400,
            messages: request.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          timeoutMs: 45_000,
        }
      );

      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("OpenAI 응답에 content가 없습니다.");
      }

      return {
        content,
        provider: this.name,
        model: data.model ?? model,
        raw: data,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw new Error(
          `OpenAI API 오류 (${error.status}): ${error.body?.slice(0, 240) ?? error.message}`
        );
      }
      throw error;
    }
  }

  async *chatStream(request: LlmChatRequest): AsyncIterable<string> {
    const { apiKey, baseUrl, model } = env.openai;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 400,
        stream: true,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `OpenAI stream 오류 (${res.status}): ${body.slice(0, 240)}`
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          /* skip partial */
        }
      }
    }
  }
}
