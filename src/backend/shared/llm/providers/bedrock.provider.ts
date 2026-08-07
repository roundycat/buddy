import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type ContentBlock,
  type Message,
  type Tool,
  type ToolChoice,
  type ToolConfiguration,
} from "@aws-sdk/client-bedrock-runtime";
import type { DocumentType } from "@smithy/types";
import { env } from "@/backend/shared/config/env";
import type {
  LlmChatRequest,
  LlmChatResult,
  LlmProvider,
  LlmToolChatRequest,
  LlmToolChatResult,
  LlmToolChoice,
  LlmToolSpec,
  LlmToolUse,
} from "../types";

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
      usage: {
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
      },
    };
  }

  /**
   * Converse with a tool catalogue. The model decides whether to emit `toolUse`
   * blocks; the caller runs them and feeds results back as another turn.
   */
  async chatWithTools(
    request: LlmToolChatRequest
  ): Promise<LlmToolChatResult> {
    const modelId = request.model?.trim() || env.bedrock.modelId;
    const guardrailConfig = resolveGuardrail(request);

    const messages: Message[] = request.turns.map((turn) => {
      if (turn.role === "toolResult") {
        return {
          role: "user" as const,
          content: turn.results.map<ContentBlock>((r) => ({
            toolResult: {
              toolUseId: r.toolUseId,
              content: [{ json: normalizeToolJson(r.content) }],
              ...(r.isError ? { status: "error" as const } : {}),
            },
          })),
        };
      }

      if (turn.role === "assistant") {
        const content: ContentBlock[] = [];
        if (turn.text?.trim()) content.push({ text: turn.text });
        for (const use of turn.toolUses ?? []) {
          content.push({
            toolUse: {
              toolUseId: use.toolUseId,
              name: use.name,
              input: use.input as DocumentType,
            },
          });
        }
        return { role: "assistant" as const, content };
      }

      return { role: "user" as const, content: [{ text: turn.text }] };
    });

    const response = await this.client.send(
      new ConverseCommand({
        modelId,
        ...(request.system?.trim()
          ? { system: [{ text: request.system }] }
          : {}),
        messages,
        inferenceConfig: {
          maxTokens: request.maxTokens ?? 600,
          temperature: request.temperature ?? 0.3,
        },
        ...((): { toolConfig?: ToolConfiguration } => {
          const toolConfig = buildToolConfig(request);
          return toolConfig ? { toolConfig } : {};
        })(),
        ...(guardrailConfig ? { guardrailConfig } : {}),
      })
    );

    const blocks = response.output?.message?.content ?? [];
    const text = blocks
      .map((block) => ("text" in block ? block.text ?? "" : ""))
      .join("")
      .trim();

    const toolUses: LlmToolUse[] = [];
    for (const block of blocks) {
      if (!("toolUse" in block) || !block.toolUse) continue;
      const { toolUseId, name, input } = block.toolUse;
      if (!toolUseId || !name) continue;
      toolUses.push({
        toolUseId,
        name,
        input: (input ?? {}) as Record<string, unknown>,
      });
    }

    return {
      text,
      toolUses,
      stopReason: response.stopReason ?? "end_turn",
      provider: this.name,
      model: modelId,
      usage: {
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
      },
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

function toBedrockTool(tool: LlmToolSpec): Tool {
  return {
    toolSpec: {
      name: tool.name,
      description: tool.description,
      inputSchema: { json: tool.inputSchema as DocumentType },
    },
  };
}

function toBedrockToolChoice(choice: LlmToolChoice | undefined): ToolChoice | undefined {
  if (!choice || choice === "auto") return { auto: {} };
  if (choice === "any") return { any: {} };
  return { tool: { name: choice.name } };
}

function buildToolConfig(
  request: LlmToolChatRequest
): ToolConfiguration | undefined {
  if (request.disableTools) return undefined;
  if (!request.tools.length) return undefined;
  return {
    tools: request.tools.map(toBedrockTool),
    toolChoice: toBedrockToolChoice(request.toolChoice),
  };
}

/** Converse `toolResult` needs a JSON object, never a bare array or scalar. */
function normalizeToolJson(content: unknown): DocumentType {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content as DocumentType;
  }
  return { result: (content ?? null) as DocumentType };
}

function resolveGuardrail(request: Pick<LlmChatRequest, "guardrail">) {
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
