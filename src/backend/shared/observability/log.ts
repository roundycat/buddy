import "server-only";
import { randomUUID } from "crypto";
import type { ObservationFields } from "./types";

/** JSON line for CloudWatch Logs / local console. */
export function logObservation(fields: ObservationFields): void {
  const line = {
    level: fields.success ? "info" : "error",
    ts: new Date().toISOString(),
    requestId: fields.requestId ?? randomUUID(),
    feature: fields.feature,
    operation: fields.operation,
    model: fields.model,
    latencyMs: fields.latencyMs,
    inputTokens: fields.inputTokens,
    outputTokens: fields.outputTokens,
    success: fields.success,
    errorName: fields.errorName,
    message: fields.message,
  };
  if (fields.success) {
    console.info("[bedi:obs]", JSON.stringify(line));
  } else {
    console.error("[bedi:obs]", JSON.stringify(line));
  }
}

export function newRequestId(): string {
  return randomUUID();
}
