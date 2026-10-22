import fs from "node:fs";
import path from "node:path";
import { assertCronAuthorized } from "@/backend/features/batch/cron-auth";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";
import { assessChildMessage } from "@/backend/ai/safety/v2/assess";
import { mergeReviewedLevel, reviewWithLlm, shouldReview } from "@/backend/ai/safety/v2/llm-review";
import {
  computeSafetyMetrics,
  parseJsonl,
  toPrediction,
  type EvalItem,
} from "@/backend/ai/safety/v2/eval-metrics";
import type { SafetyLevel } from "@/backend/ai/safety/v2/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Measure the deployed safety pipeline on a bundled evaluation set.
 * POST /api/admin/safety-eval?set=heldout|dev   Header: x-bedi-cron-secret
 *
 * Returns aggregate metrics only (no sentences), for rules alone and for
 * rules + LLM review (the live chat path), plus review latency.
 */
const SETS: Record<string, string> = {
  heldout: "eval/heldout/crisis-test.jsonl",
  dev: "eval/dev/crisis-dev.jsonl",
};

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function POST(request: Request) {
  return withApiGuard(async () => {
    assertCronAuthorized(request);
    const setName = new URL(request.url).searchParams.get("set") ?? "heldout";
    const rel = SETS[setName];
    if (!rel) throw new HttpError("Unknown set", 400);
    const file = path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) throw new HttpError("Evaluation set is not bundled", 404);
    const items: EvalItem[] = parseJsonl(fs.readFileSync(file, "utf8"));

    const latencies: number[] = [];
    let reviewed = 0;
    let raised = 0;
    const rows = await mapPool(items, 4, async (item) => {
      const rules = assessChildMessage({ text: item.text, context: item.context ?? [] });
      let live: SafetyLevel = rules.level;
      if (shouldReview(rules)) {
        reviewed += 1;
        const started = Date.now();
        const level = await reviewWithLlm({ text: item.text, context: item.context ?? [], timeoutMs: 8000 });
        latencies.push(Date.now() - started);
        live = mergeReviewedLevel(rules.level, level);
        if (live !== rules.level) raised += 1;
      }
      return { rules: rules.level, live };
    });

    latencies.sort((a, b) => a - b);
    const q = (p: number) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))] : null);
    return {
      set: setName,
      n: items.length,
      rulesOnly: computeSafetyMetrics(items, rows.map((r) => toPrediction(r.rules))),
      rulesPlusLlm: computeSafetyMetrics(items, rows.map((r) => toPrediction(r.live))),
      review: { reviewed, raised, latencyMs: { p50: q(0.5), p90: q(0.9), max: latencies.at(-1) ?? null } },
      generatedAt: new Date().toISOString(),
    };
  }, "평가를 실행하지 못했어요.", "[api/admin/safety-eval]");
}
