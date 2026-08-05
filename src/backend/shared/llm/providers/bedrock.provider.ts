import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "@/backend/shared/config/env";
import type { LlmChatRequest, LlmChatResult, LlmProvider } from "../types";

/**
 * AWS Bedrock Converse API.
 * Ready for Lambda migration — same SDK calls work in serverless.
 */
export class BedrockLlmProvider implements LlmProvider {
  readonly name = "bedrock";
  private client: BedrockRuntimeClient;

  constructor() {
    const { region, accessKeyId, secretAccessKey, sessionToken } = env.bedrock;

    this.client = new BedrockRuntimeClient({
      region,
      ...(accessKeyId && secretAccessKey
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
              ...(sessionToken ? { sessionToken } : {}),
            },
          }
        : {}),
    });
  }

  private buildPayload(request: LlmChatRequest) {
    const modelId = request.model?.trim() || env.bedrock.modelId;
    const systemParts = request.messages
      .filter((m) => m.role === "system")
      .map((m) => ({ text: m.content }));

    const conversation = request.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: [{ text: m.content }],
      }));

    if (conversation.length === 0) {
      throw new Error("Bedrock에 전달할 user/assistant 메시지가 없습니다.");
    }

    return {
      modelId,
      systemParts,
      conversation,
      inferenceConfig: {
        maxTokens: request.maxTokens ?? 400,
        temperature: request.temperature ?? 0.7,
      },
      guardrailConfig: resolveGuardrail(request),
    };
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResult> {
    const { modelId, systemParts, conversation, inferenceConfig, guardrailConfig } =
      this.buildPayload(request);

    const response = await this.client.send(
      new ConverseCommand({
        modelId,
        ...(systemParts.length ? { system: systemParts } : {}),
        messages: conversation,
        inferenceConfig,
        ...(guardrailConfig ? { guardrailConfig } : {}),
      })
    );

    const content = response.output?.message?.content
      ?.map((block) => ("text" in block ? block.text ?? "" : ""))
      .join("")
      .trim();

    if (!content) {
      // Guardrail may block with no message text — surface blocked messaging if present
      const blocked =
        response.stopReason === "guardrail_intervened"
          ? env.bedrock.guardrailId
            ? "의료 진단이나 처방은 할 수 없어요. 궁금한 건 보호자·의료진과 함께 확인해요."
            : null
          : null;
      if (blocked) {
        return {
          content: blocked,
          provider: this.name,
          model: modelId,
          raw: response,
        };
      }
      throw new Error("Bedrock 응답에 text가 없습니다.");
    }

    return {
      content,
      provider: this.name,
      model: modelId,
      raw: response,
    };
  }

  async *chatStream(request: LlmChatRequest): AsyncIterable<string> {
    const { modelId, systemParts, conversation, inferenceConfig, guardrailConfig } =
      this.buildPayload(request);

    const response = await this.client.send(
      new ConverseStreamCommand({
        modelId,
        ...(systemParts.length ? { system: systemParts } : {}),
        messages: conversation,
        inferenceConfig,
        ...(guardrailConfig ? { guardrailConfig } : {}),
      })
    );

    if (!response.stream) {
      throw new Error("Bedrock 스트림이 비어 있습니다.");
    }

    for await (const event of response.stream) {
      const delta = event.contentBlockDelta?.delta;
      if (delta && "text" in delta && delta.text) {
        yield delta.text;
      }
    }
  }
}

function resolveGuardrail(request: LlmChatRequest) {
  if (request.guardrail === false) return undefined;
  if (request.guardrail) {
    return {
      guardrailIdentifier: request.guardrail.guardrailIdentifier,
      guardrailVersion: request.guardrail.guardrailVersion,
      trace: "enabled" as const,
    };
  }
  const id = env.bedrock.guardrailId;
  if (!id) return undefined;
  return {
    guardrailIdentifier: id,
    guardrailVersion: env.bedrock.guardrailVersion || "DRAFT",
    trace: "enabled" as const,
  };
}
