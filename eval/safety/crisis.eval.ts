/**
 * Offline evaluation: v1 crisis regex vs Beddy 2.0 safety signal rules.
 *
 *   npm run eval:safety                         # dev set
 *   EVAL_SET=heldout npm run eval:safety        # held-out set (final measurement only)
 *   EVAL_SHOW_ERRORS=1 npm run eval:safety      # list dev-set mistakes
 *
 * Writes eval/results/crisis-<set>.json and .md
 * The deployed pipeline (rules + LLM review) is measured by /api/admin/safety-eval.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { detectCrisisSignal } from "@/backend/ai/safety/crisis-detect";
import { assessChildMessage } from "@/backend/ai/safety/v2/assess";
import {
  computeSafetyMetrics,
  METRIC_LABELS,
  parseJsonl,
  pct,
  perCategory,
  toPrediction,
  type EvalItem,
  type EvalPrediction,
} from "@/backend/ai/safety/v2/eval-metrics";

const SET = (process.env.EVAL_SET ?? "dev").trim();
const FILE =
  SET === "heldout"
    ? "eval/heldout/crisis-test.jsonl"
    : SET === "dev"
      ? "eval/dev/crisis-dev.jsonl"
      : SET;

function predictV1(item: EvalItem): EvalPrediction {
  const r = detectCrisisSignal(item.text);
  return toPrediction(r.detected ? r.level : "none");
}

function predictV2(item: EvalItem): EvalPrediction {
  const a = assessChildMessage({ text: item.text, context: item.context ?? [] });
  return toPrediction(a.level, a.abuse);
}

function rate(n: number, d: number): string {
  return d ? `${((100 * n) / d).toFixed(1)}%` : "-";
}

describe(`safety eval — ${SET}`, () => {
  it("v1 vs v2", () => {
    const items = parseJsonl(fs.readFileSync(path.resolve(FILE), "utf8"));
    const v1 = items.map(predictV1);
    const v2 = items.map(predictV2);
    const m1 = computeSafetyMetrics(items, v1);
    const m2 = computeSafetyMetrics(items, v2);
    const c1 = perCategory(items, v1);
    const c2 = perCategory(items, v2);

    const counts = items.reduce<Record<string, number>>((acc, it) => {
      acc[it.level] = (acc[it.level] ?? 0) + 1;
      return acc;
    }, {});

    const md: string[] = [];
    md.push(`# 위기 신호 평가 — ${SET} (${items.length}문장)`);
    md.push("");
    md.push(`라벨 분포: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
    md.push("");
    md.push("| 지표 | v1 (정규식) | v2 (Beddy 2.0 규칙) |");
    md.push("|---|---|---|");
    for (const [label, key] of METRIC_LABELS) {
      md.push(`| ${label} | ${pct(m1[key])} | ${pct(m2[key])} |`);
    }
    md.push("");
    md.push("| 범주 | 문장 수 | v1 맞음 | v2 맞음 |");
    md.push("|---|---|---|---|");
    for (const key of Object.keys(c2).sort()) {
      md.push(`| ${key} | ${c2[key].n} | ${rate(c1[key].correct, c1[key].n)} | ${rate(c2[key].correct, c2[key].n)} |`);
    }
    md.push("");
    md.push("v1은 '관찰'과 '보호' 단계가 없어 해당 지표는 구조적으로 0입니다.");

    fs.mkdirSync("eval/results", { recursive: true });
    const stem = SET === "dev" || SET === "heldout" ? SET : path.basename(SET, ".jsonl");
    fs.writeFileSync(`eval/results/crisis-${stem}.md`, md.join("\n") + "\n");
    fs.writeFileSync(
      `eval/results/crisis-${stem}.json`,
      JSON.stringify({ set: SET, file: FILE, n: items.length, counts, v1: m1, v2: m2, perCategory: { v1: c1, v2: c2 }, generatedAt: new Date().toISOString() }, null, 2) + "\n"
    );
    console.log(md.join("\n"));

    if (process.env.EVAL_SHOW_ERRORS === "1" && SET !== "heldout") {
      const errs = items
        .map((it, i) => ({ it, p: v2[i] }))
        .filter(({ it, p }) => p.level !== it.level);
      console.log(`\n--- v2 mismatches (${errs.length}) ---`);
      for (const { it, p } of errs) {
        const r = assessChildMessage({ text: it.text, context: it.context ?? [] });
        console.log(`${it.id}\tgold=${it.level}\tv2=${p.level}\t${it.text}\t${(it.context ?? []).join(" / ")}\trules=${r.rules.join(",")}\tsup=${r.suppressors.join(",")}`);
      }
    }

    expect(items.length).toBeGreaterThan(0);
  });
});
