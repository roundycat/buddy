import "server-only";

/**
 * AI Orchestrator — the only LLM entry surface feature services should use.
 *
 * Responsibilities:
 * - Model routing (chat / analysis / quality)
 * - Guardrails attachment
 * - Tool loops & streaming companion chat
 * - Agent / RAG pipeline timing (`runPipeline`)
 *
 * Non-responsibilities:
 * - Does NOT decide Child vs Parent ownership of a request
 * - Does NOT choose which feature handles an API call (controllers → services do)
 * - Controllers / Route Handlers must NEVER import this module
 *
 * Implementation lives in `llm-gateway` + `agent/agent-run`; this file is the
 * stable orchestrator contract for Child & Parent domain services.
 */

export {
  runLlm,
  runLlmWithTools,
  streamCompanionChat,
  companionChat,
  resolveModelForPurpose,
  observeBatchRun,
  observeKbSearch,
  ToolUseUnsupportedError,
  type AiPurpose,
} from "@/backend/ai/llm-gateway";

export {
  runPipeline,
  type RunHandle,
  type RunTraceStep,
} from "@/backend/ai/agent/agent-run";

export {
  runToolAgent,
  ToolAgentUnsupportedError,
  type AgentTool,
  type AgentToolCallLog,
  type AgentRunOutcome,
  type AgentTraceStep,
} from "@/backend/ai/agent/tool-agent";

/**
 * `{NAME}` scrubbing. `runLlm` already applies this to fresh answers; services
 * re-apply it on read so prose persisted before the fix is cleaned up too.
 */
export {
  fillNamePlaceholders,
  fillNamePlaceholdersDeep,
  hasNamePlaceholder,
} from "@/backend/shared/llm/sanitize";
