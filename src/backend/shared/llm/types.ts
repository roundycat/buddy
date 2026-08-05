/**
 * Shared LLM contracts used by all providers.
 */

export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmChatRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmChatResult {
  content: string;
  provider: string;
  model: string;
  raw?: unknown;
}

export interface LlmProvider {
  readonly name: string;
  chat(request: LlmChatRequest): Promise<LlmChatResult>;
  /** Optional token stream — providers that support it yield text deltas. */
  chatStream?(request: LlmChatRequest): AsyncIterable<string>;
}
