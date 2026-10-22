import "server-only";

/**
 * Rough USD / 1M tokens for cost estimates in logs (not billing truth).
 * Source: platform.claude.com/docs/en/about-claude/pricing (checked 2026-10-22).
 * Update when model pricing changes.
 */
const RATE_PER_1M: Record<string, { input: number; output: number }> = {
  "haiku-5": { input: 0.1, output: 0.5 },
  "haiku-4-5": { input: 1, output: 5 },
  haiku: { input: 0.8, output: 4.0 },
  "opus-5": { input: 4, output: 20 },
  opus: { input: 5, output: 25 },
  "sonnet-5": { input: 2, output: 10 },
  sonnet: { input: 3, output: 15 },
  default: { input: 1, output: 5 },
};

function ratesFor(model: string) {
  if (model.includes("haiku-5")) return RATE_PER_1M["haiku-5"]!;
  if (model.includes("haiku-4-5")) return RATE_PER_1M["haiku-4-5"]!;
  if (model.includes("haiku")) return RATE_PER_1M.haiku!;
  if (model.includes("opus-5")) return RATE_PER_1M["opus-5"]!;
  if (model.includes("opus")) return RATE_PER_1M.opus!;
  if (model.includes("sonnet-5")) return RATE_PER_1M["sonnet-5"]!;
  if (model.includes("sonnet")) return RATE_PER_1M.sonnet!;
  return RATE_PER_1M.default!;
}

export function estimateAiCostUsd(input: {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}): number {
  const rates = ratesFor((input.model ?? "").toLowerCase());
  const inT = input.inputTokens ?? 0;
  const outT = input.outputTokens ?? 0;
  return (inT * rates.input + outT * rates.output) / 1_000_000;
}
