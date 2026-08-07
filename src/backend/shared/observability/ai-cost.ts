import "server-only";

/**
 * Rough USD / 1M tokens for CloudWatch cost estimates (not billing truth).
 * Update when model pricing changes.
 */
const RATE_PER_1M: Record<
  string,
  { input: number; output: number }
> = {
  haiku: { input: 0.8, output: 4.0 },
  opus: { input: 15, output: 75 },
  sonnet: { input: 3, output: 15 },
  default: { input: 1, output: 5 },
};

export function estimateAiCostUsd(input: {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}): number {
  const model = (input.model ?? "").toLowerCase();
  const rates =
    model.includes("opus")
      ? RATE_PER_1M.opus!
      : model.includes("sonnet")
        ? RATE_PER_1M.sonnet!
        : model.includes("haiku")
          ? RATE_PER_1M.haiku!
          : RATE_PER_1M.default!;
  const inT = input.inputTokens ?? 0;
  const outT = input.outputTokens ?? 0;
  return (inT * rates.input + outT * rates.output) / 1_000_000;
}
