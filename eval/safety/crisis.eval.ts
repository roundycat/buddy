/**
 * Offline evaluation: v1 crisis regex vs Beddy 2.0 safety signal rules.
 *
 *   npm run eval:safety                         # dev set
 *   EVAL_SET=heldout npm run eval:safety        # held-out set (final measurement only)
 *   EVAL_SHOW_ERRORS=1 npm run eval:safety      # list dev-set mistakes
 *
 * Writes eval/results/crisis-<set>.json and .md
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { detectCrisisSignal } from "@/backend/ai/safety/crisis-detect";
import { assessChildMessage } from "@/backend/ai/safety/v2/assess";
import { alertsGuardian, type SafetyLevel } from "@/backend/ai/safety/v2/types";

type Gold = "urgent" | "elevated" | "watch" | "protect" | "none";

interface Item {
  id: string;
  text: string;
  context?: string[];
  level: Gold;
  category: string;
  form?: string;
  note?: string;
}

interface Pred {
  level: SafetyLevel;
  alert: boolean;
  /** help resources shown to the child (any non-none action panel) */
  help: boolean;
}

const SET = (process.env.EVAL_SET ?? "dev").trim();
const FILE =
  SET === "heldout"
    ? "eval/heldout/crisis-test.jsonl"
    : SET === "dev"
      ? "eval/dev/crisis-dev.jsonl"
      : SET;

function load(file: string): Item[] {
  return fs
    .readFileSync(path.resolve(file), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Item);
}

function predictV1(item: Item): Pred {
  const r = detectCrisisSignal(item.text);
  const level: SafetyLevel = r.detected ? r.level : "none";
  return { level, alert: r.detected, help: r.detected };
}

function predictV2(item: Item): Pred {
  const r = assessChildMessage({ text: item.text, context: item.context ?? [] });
  return {
    level: r.level,
    alert: alertsGuardian(r.level),
    help: r.level !== "none" && r.level !== "watch",
  };
}

function pct(n: number, d: number): string {
  if (!d) return "-";
  return `${((100 * n) / d).toFixed(1)}%`;
}

function ratio(n: number, d: number) {
  return { n, d, rate: d ? n / d : null };
}

function metrics(items: Item[], preds: Pred[]) {
  const by = (g: Gold) => items.map((it, i) => [it, preds[i]] as const).filter(([it]) => it.level === g);
  const alertWorthy = items
    .map((it, i) => [it, preds[i]] as const)
    .filter(([it]) => it.level === "urgent" || it.level === "elevated");
  const urgent = by("urgent");
  const none = by("none");
  const watch = by("watch");
  const protect = by("protect");

  const nonPlainRisk = alertWorthy.filter(([it]) => it.form && it.form !== "plain");

  return {
    alertRecall: ratio(alertWorthy.filter(([, p]) => p.alert).length, alertWorthy.length),
    alertRecallNonPlain: ratio(nonPlainRisk.filter(([, p]) => p.alert).length, nonPlainRisk.length),
    urgentRecall: ratio(urgent.filter(([, p]) => p.level === "urgent").length, urgent.length),
    urgentHelpShown: ratio(urgent.filter(([, p]) => p.help).length, urgent.length),
    falseAlertOnNone: ratio(none.filter(([, p]) => p.alert).length, none.length),
    anyFlagOnNone: ratio(none.filter(([, p]) => p.level !== "none").length, none.length),
    watchAsWatch: ratio(watch.filter(([, p]) => p.level === "watch").length, watch.length),
    watchAlerted: ratio(watch.filter(([, p]) => p.alert).length, watch.length),
    watchMissed: ratio(watch.filter(([, p]) => p.level === "none").length, watch.length),
    protectRouted: ratio(protect.filter(([, p]) => p.level === "protect").length, protect.length),
    protectGuardianAlerted: ratio(protect.filter(([, p]) => p.alert).length, protect.length),
    exactLevel: ratio(items.filter((it, i) => preds[i].level === it.level).length, items.length),
  };
}

function perCategory(items: Item[], preds: Pred[]) {
  const out: Record<string, { n: number; correct: number }> = {};
  items.forEach((it, i) => {
    const key = it.category;
    out[key] ??= { n: 0, correct: 0 };
    out[key].n += 1;
    const p = preds[i];
    const ok =
      it.level === "none"
        ? !p.alert && p.level !== "protect"
        : it.level === "watch"
          ? p.level === "watch"
          : it.level === "protect"
            ? p.level === "protect"
            : p.alert && (it.level !== "urgent" || p.level === "urgent");
    if (ok) out[key].correct += 1;
  });
  return out;
}

describe(`safety eval — ${SET}`, () => {
  it("v1 vs v2", () => {
    const items = load(FILE);
    const v1 = items.map(predictV1);
    const v2 = items.map(predictV2);
    const m1 = metrics(items, v1);
    const m2 = metrics(items, v2);
    const c1 = perCategory(items, v1);
    const c2 = perCategory(items, v2);

    const rows: Array<[string, keyof typeof m1]> = [
      ["알림 대상(위험·긴급) 감지율", "alertRecall"],
      ["  └ 초성·변형·오타 표기만", "alertRecallNonPlain"],
      ["긴급 감지율(긴급으로 분류)", "urgentRecall"],
      ["긴급에 도움 버튼 표시", "urgentHelpShown"],
      ["일반 대화 보호자 오경보율", "falseAlertOnNone"],
      ["일반 대화 중 신호로 잡은 비율", "anyFlagOnNone"],
      ["관찰 신호를 관찰로 처리", "watchAsWatch"],
      ["관찰 신호를 보호자 알림으로 올림", "watchAlerted"],
      ["관찰 신호 놓침", "watchMissed"],
      ["학대 노출을 보호 경로로", "protectRouted"],
      ["학대 노출인데 보호자 자동 알림", "protectGuardianAlerted"],
      ["5단계 정확도", "exactLevel"],
    ];

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
    for (const [label, key] of rows) {
      const a = m1[key];
      const b = m2[key];
      md.push(`| ${label} | ${pct(a.n, a.d)} (${a.n}/${a.d}) | ${pct(b.n, b.d)} (${b.n}/${b.d}) |`);
    }
    md.push("");
    md.push("| 범주 | 문장 수 | v1 맞음 | v2 맞음 |");
    md.push("|---|---|---|---|");
    for (const key of Object.keys(c2).sort()) {
      md.push(`| ${key} | ${c2[key].n} | ${pct(c1[key].correct, c1[key].n)} | ${pct(c2[key].correct, c2[key].n)} |`);
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
