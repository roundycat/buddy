import "server-only";
import {
  newRequestId,
  observeAsync,
  observeFailure,
  recordCount,
  recordLatency,
} from "@/backend/shared/observability";

/**
 * Local execution helper for a single Agent or RAG pipeline.
 * It measures steps, enforces a time budget, and records a decision trace.
 * It does NOT route between components and does NOT decide who handles a request.
 */

export interface RunTraceStep {
  step: string;
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

export interface RunHandle {
  feature: string;
  requestId: string;
  trace: RunTraceStep[];
  /** Remaining budget (ms). If <= 0, do not start new LLM/IO. */
  remainingMs(): number;
  /** Failures throw. For required steps. */
  step<T>(name: string, fn: () => Promise<T>): Promise<T>;
  /** Failures return null and continue. For optional steps. */
  stepSafe<T>(name: string, fn: () => Promise<T>): Promise<T | null>;
  /** Record a non-LLM decision on the trace. */
  note(step: string, detail: string): void;
}

export async function runPipeline<T>(
  input: {
    feature: string;
    /** "agent" | "rag" — splits metric names */
    kind: "agent" | "rag";
    budgetMs?: number;
    model?: string;
  },
  fn: (run: RunHandle) => Promise<T>
): Promise<{ result: T; trace: RunTraceStep[] }> {
  const budgetMs =
    input.budgetMs ?? (input.kind === "agent" ? 12_000 : 3_500);
  const requestId = newRequestId();
  const started = Date.now();
  const trace: RunTraceStep[] = [];
  const wholeMetric =
    input.kind === "agent" ? "AgentLatencyMs" : "RagLatencyMs";
  const stepMetric =
    input.kind === "agent" ? "AgentStepLatencyMs" : "RagStepLatencyMs";

  const run: RunHandle = {
    feature: input.feature,
    requestId,
    trace,
    remainingMs() {
      return Math.max(0, budgetMs - (Date.now() - started));
    },
    note(step, detail) {
      trace.push({ step, ok: true, latencyMs: 0, detail });
    },
    async step(name, stepFn) {
      const t0 = Date.now();
      try {
        const value = await observeAsync(
          {
            feature: input.feature,
            operation: name,
            model: input.model,
            requestId,
            latencyMetric: stepMetric,
          },
          stepFn
        );
        trace.push({
          step: name,
          ok: true,
          latencyMs: Date.now() - t0,
        });
        return value;
      } catch (error) {
        trace.push({
          step: name,
          ok: false,
          latencyMs: Date.now() - t0,
          detail: error instanceof Error ? error.message.slice(0, 120) : "error",
        });
        throw error;
      }
    },
    async stepSafe(name, stepFn) {
      const t0 = Date.now();
      try {
        const value = await observeAsync(
          {
            feature: input.feature,
            operation: name,
            model: input.model,
            requestId,
            latencyMetric: stepMetric,
          },
          stepFn
        );
        trace.push({
          step: name,
          ok: true,
          latencyMs: Date.now() - t0,
        });
        return value;
      } catch (error) {
        observeFailure({
          feature: input.feature,
          operation: name,
          error,
          requestId,
        });
        trace.push({
          step: name,
          ok: false,
          latencyMs: Date.now() - t0,
          detail: error instanceof Error ? error.message.slice(0, 120) : "error",
        });
        return null;
      }
    },
  };

  try {
    const result = await fn(run);
    recordLatency(wholeMetric, Date.now() - started, {
      feature: input.feature,
      operation: "pipeline",
      model: input.model,
    });
    recordCount("Invocations", 1, {
      feature: input.feature,
      operation: "pipeline",
    });
    return { result, trace };
  } catch (error) {
    recordLatency(wholeMetric, Date.now() - started, {
      feature: input.feature,
      operation: "pipeline",
      model: input.model,
    });
    recordCount("Errors", 1, {
      feature: input.feature,
      operation: "pipeline",
    });
    throw error;
  }
}
