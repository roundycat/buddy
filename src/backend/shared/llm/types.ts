/**
 * Shared LLM contracts used by all providers.
 */

export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

/** What the call is for — lets a provider pick effort / thinking (Claude API). */
export type LlmPurpose = "chat" | "analysis" | "quality";

export interface LlmChatRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  purpose?: LlmPurpose;
  /** Optional per-call model override (Bedrock chat vs quality routing) */
  model?: string;
  /**
   * Bedrock Guardrail. `undefined` = use env default when set.
   * `false` = explicitly skip (rare).
   */
  guardrail?: { guardrailIdentifier: string; guardrailVersion: string } | false;
}

export interface LlmChatResult {
  content: string;
  provider: string;
  model: string;
  raw?: unknown;
  /** Bedrock Converse usage when available */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

/** A tool the model may choose to call (Bedrock Converse toolSpec). */
export interface LlmToolSpec {
  name: string;
  description: string;
  /** JSON Schema object describing the tool input */
  inputSchema: Record<string, unknown>;
}

/** The model's request to run a tool. */
export interface LlmToolUse {
  toolUseId: string;
  name: string;
  input: Record<string, unknown>;
}

/** Our answer to a tool request, fed back into the conversation. */
export interface LlmToolResult {
  toolUseId: string;
  content: unknown;
  isError?: boolean;
}

export type LlmToolTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text?: string; toolUses?: LlmToolUse[] }
  | { role: "toolResult"; results: LlmToolResult[] };

/**
 * How the model should pick tools this turn.
 * - `auto` — model may call tools or answer in text (default)
 * - `any` — model must call at least one tool
 * - `{ name }` — model must call that specific tool
 */
export type LlmToolChoice = "auto" | "any" | { name: string };

export interface LlmToolChatRequest {
  system?: string;
  turns: LlmToolTurn[];
  tools: LlmToolSpec[];
  temperature?: number;
  maxTokens?: number;
  purpose?: LlmPurpose;
  model?: string;
  guardrail?: LlmChatRequest["guardrail"];
  /**
   * When true, omit toolConfig so the model must answer in text.
   * Used on the last agent iteration to prevent endless tool loops.
   */
  disableTools?: boolean;
  /** Only applied when tools are enabled. */
  toolChoice?: LlmToolChoice;
}

export interface LlmToolChatResult {
  text: string;
  toolUses: LlmToolUse[];
  stopReason: string;
  provider: string;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface LlmProvider {
  readonly name: string;
  chat(request: LlmChatRequest): Promise<LlmChatResult>;
  /** Optional token stream — providers that support it yield text deltas. */
  chatStream?(request: LlmChatRequest): AsyncIterable<string>;
  /** Optional tool-use turn — only providers with a Converse-style tool API. */
  chatWithTools?(request: LlmToolChatRequest): Promise<LlmToolChatResult>;
}
