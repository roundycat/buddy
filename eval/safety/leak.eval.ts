/**
 * Offline evaluation: does guardian-facing text leak the child's chat?
 *   baseline (기존 방식) = Bridge privacy filter (raw-chat format / coordinates only)
 *   Beddy 2.0 = leak guard (verbatim, quote, secret, third-party name, location)
 *
 *   npm run eval:safety -- leak            # held-out leak set (150)
 *   LEAK_SET=path/to/file.jsonl npm run eval:safety -- leak
 *
 * Prints and writes aggregate metrics only — never item text.
 * Writes eval/results/leak-<set>.json and .md
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { filterBridgeText } from "@/backend/ai/bridge/privacy-filter";
import { detectLeak } from "@/backend/ai/bridge/leak-guard";

type LeakItem = {
  id: string;
  child_messages: string[];
  guardian_text: string;
  leak: boolean;
  leak_type: string;
};

const FILE = (process.env.LEAK_SET ?? "eval/heldout/leak-test.jsonl").trim();

function parse(raw: string): LeakItem[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LeakItem);
}

function pct(n: number, d: number) {
  return d ? `${((100 * n) / d).toFixed(1)}%` : "-";
}

function score(items: LeakItem[], pred: boolean[]) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  items.forEach((it, i) => {
    if (it.leak && pred[i]) tp++;
    else if (it.leak) fn++;
    else if (pred[i]) fp++;
    else tn++;
  });
  const byType: Record<string, { n: number; caught: number }> = {};
  items.forEach((it, i) => {
    if (!it.leak) return;
    const t = it.leak_type || "unknown";
    byType[t] ??= { n: 0, caught: 0 };
    byType[t].n++;
    if (pred[i]) byType[t].caught++;
  });
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    tp, fp, fn, tn,
    recall,
    falseAlarm: fp + tn ? fp / (fp + tn) : 0,
    precision,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    byType,
  };
}

describe(`leak eval — ${path.basename(FILE)}`, () => {
  it("v1 privacy filter vs v2 leak guard", () => {
    const items = parse(fs.readFileSync(path.resolve(FILE), "utf8"));
    const v1 = items.map((it) => filterBridgeText(it.guardian_text) === null);
    const v2 = items.map((it) => detectLeak(it.guardian_text, it.child_messages ?? []).leak);
    const m1 = score(items, v1);
    const m2 = score(items, v2);
    const leaks = items.filter((it) => it.leak).length;

    const md: string[] = [];
    md.push(`# 보호자 글 유출 평가 — ${path.basename(FILE)} (${items.length}문장, 유출 ${leaks} · 정상 ${items.length - leaks})`);
    md.push("");
    md.push("| 지표 | 기존 방식 | Beddy 2.0 유출 검사 |");
    md.push("|---|---|---|");
    md.push(`| 유출 탐지율 | ${pct(m1.tp, m1.tp + m1.fn)} | ${pct(m2.tp, m2.tp + m2.fn)} |`);
    md.push(`| 정상 요약 오탐률 | ${pct(m1.fp, m1.fp + m1.tn)} | ${pct(m2.fp, m2.fp + m2.tn)} |`);
    md.push(`| 정밀도 | ${pct(m1.tp, m1.tp + m1.fp)} | ${pct(m2.tp, m2.tp + m2.fp)} |`);
    md.push(`| F1 | ${(m1.f1 * 100).toFixed(1)} | ${(m2.f1 * 100).toFixed(1)} |`);
    md.push("");
    md.push("| 유출 유형 | 문장 수 | 기존 방식 탐지 | 2.0 탐지 |");
    md.push("|---|---|---|---|");
    for (const t of Object.keys(m2.byType).sort()) {
      const a = m1.byType[t] ?? { n: m2.byType[t]!.n, caught: 0 };
      const b = m2.byType[t]!;
      md.push(`| ${t} | ${b.n} | ${pct(a.caught, a.n)} | ${pct(b.caught, b.n)} |`);
    }
    md.push("");
    md.push("기존 방식은 대화 기록 형식(\"아이: …\" 여러 줄)과 좌표만 막아, 문장 단위 유출은 구조적으로 보지 못합니다.");

    const stem = path.basename(FILE, ".jsonl");
    fs.mkdirSync("eval/results", { recursive: true });
    fs.writeFileSync(`eval/results/leak-${stem}.md`, md.join("\n") + "\n");
    fs.writeFileSync(
      `eval/results/leak-${stem}.json`,
      JSON.stringify(
        { file: FILE, n: items.length, leaks, v1: m1, v2: m2, generatedAt: new Date().toISOString() },
        null,
        2
      ) + "\n"
    );
    console.log(md.join("\n"));
    expect(items.length).toBeGreaterThan(0);
  });
});
