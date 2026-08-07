import "server-only";
import {
  resolveModelForPurpose,
  runLlmWithTools,
  ToolUseUnsupportedError,
  type AiPurpose,
} from "@/backend/ai/llm-gateway";
import type {
  LlmToolChoice,
  LlmToolResult,
  LlmToolSpec,
  LlmToolTurn,
} from "@/backend/shared/llm/types";
import {
  newRequestId,
  observeAsync,
  observeFailure,
  recordCount,
  recordLatency,
} from "@/backend/shared/observability";

/**
 * Agent runtime — drives a bounded Bedrock tool-use loop for ONE agent.
 * Executes tools the model asks for, feeds results back, stops on a
 * terminal tool / iteration cap / time budget.
 *
 * Does NOT route between features or decide who handles a request.
 */

export interface AgentToolCallLog {
  name: string;
  input: unknown;
  ok: boolean;
  latencyMs: number;
  /** Successful tool output (when ok). Useful for downstream steps. */
  output?: unknown;
  error?: string;
}

export interface AgentTraceStep {
  step: string;
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

/** One tool. `run` must return a JSON-serializable value. */
export interface AgentTool {
  spec: LlmToolSpec;
  run: (input: Record<string, unknown>) => Promise<unknown>;
  /** When true, calling this tool ends the loop and returns its input as `submitted`. */
  terminal?: boolean;
}

export interface AgentRunOutcome {
  /** Input of the terminal tool, if one was called */
  submitted: Record<string, unknown> | null;
  finalText: string;
  stopReason: string;
  iterations: number;
  toolCalls: AgentToolCallLog[];
  trace: AgentTraceStep[];
  /** True when we hit the iteration or time budget without a terminal submit */
  exhausted: boolean;
}

export class ToolAgentUnsupportedError extends Error {
  constructor(providerName: string) {
    super(`Provider "${providerName}" does not support tool use.`);
    this.name = "ToolAgentUnsupportedError";
  }
}

/**
 * Injected converse for unit tests. Production uses `runLlmWithTools`.
 */
export type ToolAgentConverse = (input: {
  system?: string;
  turns: LlmToolTurn[];
  tools: LlmToolSpec[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  disableTools?: boolean;
  toolChoice?: LlmToolChoice;
}) => Promise<{
  text: string;
  toolUses: Array<{
    toolUseId: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  stopReason: string;
}>;

export async function runToolAgent(input: {
  feature: string;
  system: string;
  task: string;
  tools: AgentTool[];
  purpose?: AiPurpose;
  model?: string;
  maxIterations?: number;
  budgetMs?: number;
  temperature?: number;
  maxTokens?: number;
  childName?: string;
  /** Test seam — production leaves this undefined */
  converse?: ToolAgentConverse;
}): Promise<AgentRunOutcome> {
  const purpose = input.purpose ?? "analysis";
  const model = input.model ?? resolveModelForPurpose(purpose);
  const maxIterations = input.maxIterations ?? 6;
  const budgetMs = input.budgetMs ?? 12_000;
  const requestId = newRequestId();
  const started = Date.now();

  const toolByName = new Map(input.tools.map((t) => [t.spec.name, t]));
  const specs = input.tools.map((t) => t.spec);
  const terminalTools = input.tools.filter((t) => t.terminal);

  const converse: ToolAgentConverse =
    input.converse ??
    (async (req) =>
      runLlmWithTools({
        feature: input.feature,
        purpose,
        system: req.system,
        turns: req.turns,
        tools: req.tools,
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        childName: input.childName,
        disableTools: req.disableTools,
        toolChoice: req.toolChoice,
      }));

  return observeAsync(
    {
      feature: input.feature,
      operation: "agent",
      model,
      requestId,
      latencyMetric: "AgentLatencyMs",
    },
    async () => {
      const turns: LlmToolTurn[] = [{ role: "user", text: input.task }];
      const toolCalls: AgentToolCallLog[] = [];
      const trace: AgentTraceStep[] = [];
      let iterations = 0;
      let finalText = "";
      let stopReason = "end_turn";

      const remainingMs = () => Math.max(0, budgetMs - (Date.now() - started));

      try {
        for (let i = 0; i < maxIterations; i++) {
          if (remainingMs() <= 0) {
            trace.push({
              step: "budget",
              ok: false,
              latencyMs: Date.now() - started,
              detail: "time_budget_exhausted",
            });
            break;
          }

          iterations = i + 1;
          const lastIteration =
            i === maxIterations - 1 || remainingMs() < 3_000;

          let turnTools = specs;
          let disableTools = false;
          let toolChoice: LlmToolChoice | undefined = "auto";

          if (lastIteration) {
            if (terminalTools.length > 0) {
              // Force a plan submit rather than empty-handed exit.
              turnTools = terminalTools.map((t) => t.spec);
              toolChoice = { name: terminalTools[0]!.spec.name };
            } else {
              disableTools = true;
              toolChoice = undefined;
            }
          }

          const t0 = Date.now();
          let res: Awaited<ReturnType<ToolAgentConverse>>;
          try {
            res = await converse({
              system: input.system,
              turns,
              tools: turnTools,
              temperature: input.temperature ?? 0.3,
              maxTokens: input.maxTokens ?? 600,
              model,
              disableTools,
              toolChoice,
            });
          } catch (error) {
            if (
              error instanceof ToolUseUnsupportedError ||
              (error instanceof Error &&
                error.name === "ToolUseUnsupportedError")
            ) {
              throw new ToolAgentUnsupportedError("active");
            }
            throw error;
          }

          const turnMs = Date.now() - t0;
          finalText = res.text ?? "";
          stopReason = res.stopReason ?? "end_turn";
          trace.push({
            step: `converse.${iterations}`,
            ok: true,
            latencyMs: turnMs,
            detail: `stop=${stopReason};tools=${res.toolUses.length}`,
          });

          const wantsTools =
            (stopReason === "tool_use" || res.toolUses.length > 0) &&
            res.toolUses.length > 0;

          if (!wantsTools) {
            recordCount("AgentLoopIterations", iterations, {
              feature: input.feature,
              operation: "loop",
            });
            return {
              submitted: null,
              finalText,
              stopReason,
              iterations,
              toolCalls,
              trace,
              exhausted: false,
            };
          }

          turns.push({
            role: "assistant",
            text: res.text || undefined,
            toolUses: res.toolUses,
          });

          const results: LlmToolResult[] = [];
          let submitted: Record<string, unknown> | null = null;

          for (const use of res.toolUses) {
            const tool = toolByName.get(use.name);
            if (!tool) {
              const err = `unknown tool: ${use.name}`;
              toolCalls.push({
                name: use.name,
                input: use.input,
                ok: false,
                latencyMs: 0,
                error: err,
              });
              recordCount("AgentToolErrors", 1, {
                feature: input.feature,
                operation: use.name.slice(0, 64),
              });
              results.push({
                toolUseId: use.toolUseId,
                content: { error: err },
                isError: true,
              });
              continue;
            }

            if (tool.terminal) {
              const log: AgentToolCallLog = {
                name: use.name,
                input: use.input,
                ok: true,
                latencyMs: 0,
                output: use.input,
              };
              toolCalls.push(log);
              recordCount("AgentToolCalls", 1, {
                feature: input.feature,
                operation: use.name.slice(0, 64),
              });
              submitted = use.input;
              // Still acknowledge other tool results this turn? Terminal ends.
              // Bedrock doesn't need a toolResult if we stop the loop here.
              recordCount("AgentLoopIterations", iterations, {
                feature: input.feature,
                operation: "loop",
              });
              return {
                submitted,
                finalText,
                stopReason,
                iterations,
                toolCalls,
                trace,
                exhausted: false,
              };
            }

            const toolStarted = Date.now();
            try {
              const output = await tool.run(use.input);
              const latencyMs = Date.now() - toolStarted;
              toolCalls.push({
                name: use.name,
                input: use.input,
                ok: true,
                latencyMs,
                output,
              });
              recordLatency("AgentToolLatencyMs", latencyMs, {
                feature: input.feature,
                operation: use.name.slice(0, 64),
              });
              recordCount("AgentToolCalls", 1, {
                feature: input.feature,
                operation: use.name.slice(0, 64),
              });
              results.push({
                toolUseId: use.toolUseId,
                content: output,
              });
            } catch (error) {
              const latencyMs = Date.now() - toolStarted;
              const message =
                error instanceof Error
                  ? error.message.slice(0, 240)
                  : String(error);
              toolCalls.push({
                name: use.name,
                input: use.input,
                ok: false,
                latencyMs,
                error: message,
              });
              recordCount("AgentToolErrors", 1, {
                feature: input.feature,
                operation: use.name.slice(0, 64),
              });
              observeFailure({
                feature: input.feature,
                operation: use.name.slice(0, 64),
                error,
                requestId,
              });
              results.push({
                toolUseId: use.toolUseId,
                content: { error: message },
                isError: true,
              });
            }
          }

          // All toolUses this turn must be answered together.
          turns.push({ role: "toolResult", results });
        }

        recordCount("AgentLoopIterations", iterations, {
          feature: input.feature,
          operation: "loop",
        });
        recordCount("AgentExhausted", 1, {
          feature: input.feature,
          operation: "loop",
        });
        return {
          submitted: null,
          finalText,
          stopReason,
          iterations,
          toolCalls,
          trace,
          exhausted: true,
        };
      } catch (error) {
        if (error instanceof ToolAgentUnsupportedError) throw error;
        observeFailure({
          feature: input.feature,
          operation: "agent",
          error,
          requestId,
        });
        throw error;
      }
    }
  );
}
