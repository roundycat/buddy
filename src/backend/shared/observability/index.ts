import "server-only";
import { logObservation, newRequestId } from "./log";
import { putBeddyMetrics, recordCount, recordLatency } from "./metrics";
import { estimateAiCostUsd } from "./ai-cost";
import type { ObservationFields } from "./types";
import { StandardUnit } from "@aws-sdk/client-cloudwatch";

export type { ObservationFields } from "./types";
export { logObservation, newRequestId } from "./log";
export {
  BEDDY_METRIC_NAMESPACE,
  putBeddyMetrics,
  recordCount,
  recordLatency,
} from "./metrics";
export { estimateAiCostUsd } from "./ai-cost";

export interface ObserveOptions {
  feature: string;
  operation?: string;
  model?: string;
  requestId?: string;
  /** CloudWatch metric for latency (default BedrockLatencyMs for ai.*) */
  latencyMetric?: string;
}

type UsageLike = {
  usage?: { inputTokens?: number; outputTokens?: number };
};

function readUsage(result: unknown): {
  inputTokens?: number;
  outputTokens?: number;
} {
  if (!result || typeof result !== "object") return {};
  const u = (result as UsageLike).usage;
  if (!u) return {};
  return {
    inputTokens:
      typeof u.inputTokens === "number" ? u.inputTokens : undefined,
    outputTokens:
      typeof u.outputTokens === "number" ? u.outputTokens : undefined,
  };
}

/**
 * Time an async call, emit structured log + CloudWatch latency/error/token metrics.
 */
export async function observeAsync<T>(
  options: ObserveOptions,
  fn: () => Promise<T>
): Promise<T> {
  const requestId = options.requestId ?? newRequestId();
  const started = Date.now();
  const latencyMetric = options.latencyMetric ?? "BedrockLatencyMs";

  try {
    const result = await fn();
    const latencyMs = Date.now() - started;
    const usage = readUsage(result);
    const fields: ObservationFields = {
      feature: options.feature,
      operation: options.operation,
      model: options.model,
      latencyMs,
      success: true,
      requestId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    };
    logObservation(fields);

    const metrics: Parameters<typeof putBeddyMetrics>[0] = [
      {
        name: latencyMetric,
        value: latencyMs,
        unit: StandardUnit.Milliseconds,
        feature: options.feature,
        model: options.model,
        operation: options.operation,
      },
      {
        name: "Invocations",
        value: 1,
        unit: StandardUnit.Count,
        feature: options.feature,
        model: options.model,
        operation: options.operation,
      },
    ];

    if (typeof usage.inputTokens === "number") {
      metrics.push({
        name: "InputTokens",
        value: usage.inputTokens,
        unit: StandardUnit.Count,
        feature: options.feature,
        model: options.model,
        operation: options.operation,
      });
    }
    if (typeof usage.outputTokens === "number") {
      metrics.push({
        name: "OutputTokens",
        value: usage.outputTokens,
        unit: StandardUnit.Count,
        feature: options.feature,
        model: options.model,
        operation: options.operation,
      });
    }
    const cost = estimateAiCostUsd({
      model: options.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    if (cost > 0) {
      metrics.push({
        name: "AiCostUsd",
        value: cost,
        unit: StandardUnit.None,
        feature: options.feature,
        model: options.model,
        operation: options.operation,
      });
    }

    putBeddyMetrics(metrics);
    return result;
  } catch (error) {
    const latencyMs = Date.now() - started;
    const errorName =
      error instanceof Error ? error.name || "Error" : "UnknownError";
    const message =
      error instanceof Error ? error.message.slice(0, 240) : String(error);
    logObservation({
      feature: options.feature,
      operation: options.operation,
      model: options.model,
      latencyMs,
      success: false,
      requestId,
      errorName,
      message,
    });
    putBeddyMetrics([
      {
        name: latencyMetric,
        value: latencyMs,
        unit: StandardUnit.Milliseconds,
        feature: options.feature,
        model: options.model,
        operation: options.operation,
      },
      {
        name: "Errors",
        value: 1,
        unit: StandardUnit.Count,
        feature: options.feature,
        model: options.model,
        operation: options.operation,
      },
      {
        name: "Invocations",
        value: 1,
        unit: StandardUnit.Count,
        feature: options.feature,
        model: options.model,
        operation: options.operation,
      },
    ]);
    throw error;
  }
}

/** Record a swallowed / non-throwing failure (e.g. S3 best-effort write). */
export function observeFailure(fields: {
  feature: string;
  operation: string;
  error: unknown;
  requestId?: string;
  metricName?: string;
}): void {
  const errorName =
    fields.error instanceof Error
      ? fields.error.name || "Error"
      : "UnknownError";
  const message =
    fields.error instanceof Error
      ? fields.error.message.slice(0, 240)
      : String(fields.error);
  logObservation({
    feature: fields.feature,
    operation: fields.operation,
    success: false,
    requestId: fields.requestId ?? newRequestId(),
    errorName,
    message,
  });
  recordCount(fields.metricName ?? "Errors", 1, {
    feature: fields.feature,
    operation: fields.operation,
  });
}
