/**
 * Structured observation fields for Beddy AI / storage paths.
 */
export interface ObservationFields {
  feature: string;
  model?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  success: boolean;
  requestId?: string;
  operation?: string;
  errorName?: string;
  message?: string;
}
