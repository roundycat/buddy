import "server-only";
import { logObservation, newRequestId } from "./log";
import { putBeddyMetrics, recordCount, recordLatency } from "./metrics";
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

export interface ObserveOptions {
  feature: string;
  operation?: string;
  model?: string;
  requestId?: string;
  /** CloudWatch metric for latency (default BedrockLatencyMs for ai.*) */
  latencyMetric?: string;
}

/**
 * Time an async call, emit structured log + CloudWatch latency/error metrics.
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
    const fields: ObservationFields = {
      feature: options.feature,
      operation: options.operation,
      model: options.model,
      latencyMs,
      success: true,
      requestId,
    };
    logObservation(fields);
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
        name: "Invocations",
        value: 1,
        unit: StandardUnit.Count,
        feature: options.feature,
        model: options.model,
        operation: options.operation,
      },
    ]);
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
