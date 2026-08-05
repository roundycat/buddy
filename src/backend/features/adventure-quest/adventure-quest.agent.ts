import "server-only";
import { runLlm, type AiPurpose } from "@/backend/ai/llm-gateway";
import {
  runPipeline,
  type RunHandle,
} from "@/backend/ai/agent/agent-run";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { env } from "@/backend/shared/config/env";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";
import { recordCount } from "@/backend/shared/observability";
import { listAdventurePacksForUser } from "./adventure-quest.store";
import {
  buildFactorChips,
  buildRuleBasedPack,
  normalizeQuestKind,
  resolveScene,
} from "./adventure-quest.rules";
import type {
  AdventureContextFactors,
  AdventureDayPack,
  AdventureDayPackQuest,
  AdventureQuestKind,
  AdventureScene,
  MissionPlan,
} from "./adventure-quest.types";

/** Plan / analysis calls — Haiku. Raise to quality if needed. */
const PLAN_PURPOSE: AiPurpose = "analysis";
const GENERATE_PURPOSE: AiPurpose = "quality";

const SCENES = new Set<AdventureScene>([
  "sunny",
  "rainy",
  "treatment",
  "low_energy",
]);

const OUTDOOR_RE = /밖|야외|산책|운동장|바깥/;

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

function ruleReasoning(
  scene: AdventureScene,
  context: AdventureContextFactors
): { reasoning: string; focusSignals: string[]; avoid: string[] } {
  const focusSignals: string[] = [];
  const avoid: string[] = [];
  if (context.schedule.hasTreatment) {
    focusSignals.push(
      `치료 일정 ${context.schedule.labels.length || 1}건`
    );
  }
  if (context.energy === "low" || context.mood.id === "sleepy") {
    focusSignals.push("낮은 에너지");
    avoid.push("체력 소모");
  }
  if (context.weather.code === "rainy") {
    focusSignals.push("비 오는 날씨");
    avoid.push("야외 활동");
  }
  if (context.weather.code === "sunny") focusSignals.push("맑은 날씨");
  if (!focusSignals.length) focusSignals.push("기본 병실 루틴");

  const reasoning =
    scene === "treatment"
      ? "오늘 검사·치료 일정이 있어 짧은 부담의 실내 모험으로 잡았어요."
      : scene === "low_energy"
        ? "에너지가 낮아 보여 쉬는 날 맞춤 모험으로 골랐어요."
        : scene === "rainy"
          ? "비 오는 날이라 실내 위주 모험을 골랐어요."
          : "맑은 날 병실에서도 할 수 있는 가벼운 모험을 골랐어요.";

  return { reasoning, focusSignals, avoid };
}

async function planMission(
  run: RunHandle,
  context: AdventureContextFactors,
  date: string
): Promise<MissionPlan> {
  if (env.llmProvider === "mock") {
    const scene = resolveScene(context);
    const r = ruleReasoning(scene, context);
    run.note("plan", "fallback_to_rules_mock");
    return {
      scene,
      ...r,
      questKinds: ["photo", "chat", "observe"],
      needsRecentHistory: false,
    };
  }

  const planned = await run.stepSafe("agent.mission.plan", async () => {
    const result = await runLlm({
      feature: "agent.mission.plan",
      purpose: PLAN_PURPOSE,
      temperature: 0.3,
      maxTokens: 500,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 Beddy 미션 Agent의 계획기입니다.
입원 청소년용 오늘의 모험 장면을 고르고 JSON만 출력하세요.
scene은 sunny|rainy|treatment|low_energy 중 하나.
needsRecentHistory는 최근 미션과 제목 중복을 피해야 할 때만 true.
형식:
{"scene":"...","reasoning":"...","focusSignals":["..."],"avoid":["..."],"questKinds":["photo","chat","observe"],"needsRecentHistory":false}`),
        },
        {
          role: "user",
          content: `날짜: ${date}\n컨텍스트:\n${JSON.stringify(context, null, 2)}`,
        },
      ],
    });
    return extractJsonObject(result.content) as Partial<MissionPlan>;
  });

  if (!planned || !planned.scene || !SCENES.has(planned.scene as AdventureScene)) {
    const scene = resolveScene(context);
    const r = ruleReasoning(scene, context);
    run.note("plan", "fallback_to_rules");
    return {
      scene,
      ...r,
      questKinds: ["photo", "chat", "observe"],
      needsRecentHistory: Boolean(planned?.needsRecentHistory),
    };
  }

  const kinds = (planned.questKinds ?? []).filter((k): k is AdventureQuestKind =>
    ["photo", "garden", "chat", "post", "observe"].includes(k as string)
  );

  return {
    scene: planned.scene as AdventureScene,
    reasoning: (planned.reasoning ?? "").trim() || "컨텍스트에 맞춰 장면을 골랐어요.",
    focusSignals: (planned.focusSignals ?? []).map(String).slice(0, 6),
    avoid: (planned.avoid ?? []).map(String).slice(0, 6),
    questKinds: kinds.length ? kinds.slice(0, 3) : ["photo", "chat", "observe"],
    needsRecentHistory: Boolean(planned.needsRecentHistory),
  };
}

async function loadRecentQuestTitles(
  userId: string,
  date: string
): Promise<string[]> {
  const packs = await listAdventurePacksForUser(userId);
  const cutoff = new Date(`${date}T00:00:00+09:00`).getTime() - 7 * 86400000;
  const titles: string[] = [];
  for (const p of packs) {
    const t = new Date(`${p.date}T00:00:00+09:00`).getTime();
    if (!Number.isFinite(t) || t < cutoff || p.date === date) continue;
    for (const q of p.quests) {
      if (q.title?.trim()) titles.push(q.title.trim());
    }
  }
  return Array.from(new Set(titles)).slice(0, 21);
}

type PackValidation = { ok: true } | { ok: false; problems: string[] };

export function validatePack(
  quests: AdventureDayPackQuest[],
  plan: MissionPlan,
  avoidTitles: string[]
): PackValidation {
  const problems: string[] = [];
  if (quests.length !== 3) problems.push("quests.length는 3이어야 합니다.");

  const kinds = new Set(quests.map((q) => q.kind));
  if (kinds.size < 2) {
    problems.push("kind가 3개 모두 같습니다. 최소 2종으로 나눠 주세요.");
  }

  const avoidNorm = new Set(avoidTitles.map(normalizeTitle));
  for (const q of quests) {
    if (avoidNorm.has(normalizeTitle(q.title))) {
      problems.push(`"${q.title}"는 최근 7일 안에 이미 나온 제목입니다.`);
    }
    const titleLen = q.title.trim().length;
    if (titleLen < 2 || titleLen > 24) {
      problems.push(`제목 길이가 잘못됐습니다: "${q.title}"`);
    }
    if (!q.hint?.trim()) problems.push(`힌트가 비어 있습니다: "${q.title}"`);
    if (!Number.isInteger(q.points) || q.points < 10 || q.points > 20) {
      problems.push(`points는 10~20 정수여야 합니다: "${q.title}"`);
    }
  }

  const avoidOutdoor = plan.avoid.some((a) => /야외|밖|산책/.test(a));
  if (avoidOutdoor) {
    for (const q of quests) {
      if (OUTDOOR_RE.test(`${q.title} ${q.hint}`)) {
        problems.push(`야외 활동을 피해야 하는데 포함됨: "${q.title}"`);
      }
    }
  }

  return problems.length ? { ok: false, problems } : { ok: true };
}

function normalizePackQuest(
  quest: {
    emoji?: string;
    title: string;
    hint?: string;
    points?: number;
    kind?: string;
    progress?: AdventureDayPackQuest["progress"];
  },
  date: string,
  index: number
): AdventureDayPackQuest {
  const title = quest.title.trim().slice(0, 40);
  const hint = (quest.hint ?? "").trim().slice(0, 80);
  const kind = normalizeQuestKind(quest.kind, title, hint);
  return {
    id: `aq-${date}-${index}`,
    emoji: (quest.emoji ?? "🌈").trim().slice(0, 4) || "🌈",
    title,
    hint,
    points: Math.min(
      20,
      Math.max(10, Number.isFinite(Number(quest.points)) ? Number(quest.points) : 12)
    ),
    kind,
    progress: quest.progress ?? {},
  };
}

async function generatePack(
  run: RunHandle,
  input: {
    userId: string;
    date: string;
    context: AdventureContextFactors;
    plan: MissionPlan;
    avoidTitles: string[];
    problems?: string[];
    feature: string;
  }
): Promise<AdventureDayPack | null> {
  if (env.llmProvider === "mock") return null;

  const repairBlock =
    input.problems && input.problems.length
      ? `\n이전 생성 결과에 다음 문제가 있었습니다. 고쳐서 다시 만들어 주세요:\n${input.problems
          .map((p) => `- ${p}`)
          .join("\n")}\n`
      : "";

  const result = await run.step("agent.mission.generate", async () =>
    runLlm({
      feature: input.feature,
      purpose: GENERATE_PURPOSE,
      temperature: 0.7,
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 입원 청소년을 위한 앱 Beddy의 오늘의 모험 Agent입니다.
병실·복도·침대 근처에서 할 수 있는 작고 즐거운 모험을 제안하세요.
각 모험은 앱 안에서 할 수 있어야 합니다. kind는 photo|garden|chat|post|observe 중 하나.
위험하거나 무리한 활동만 피하세요. 한국어. JSON만 출력.`),
        },
        {
          role: "user",
          content: `오늘 날짜: ${input.date}
장면 유형: ${input.plan.scene}
장면 근거: ${input.plan.reasoning}
근거 신호: ${input.plan.focusSignals.join(", ") || "없음"}
다음은 피하세요: ${input.plan.avoid.join(", ") || "없음"}
kind 배분 우선: ${input.plan.questKinds.join(", ")}
다음 제목과 겹치지 않게 하세요: ${input.avoidTitles.join(" / ") || "(없음)"}
${repairBlock}
컨텍스트:
${JSON.stringify(input.context, null, 2)}

정확히 3개의 모험을 만들어 주세요. 형식:
{
  "headline": "이모지와 함께 오늘의 한 줄",
  "companionNote": "왜 이런 모험인지 한두 문장",
  "quests": [
    { "emoji": "🌳", "title": "짧은 제목", "hint": "어떻게 하면 되는지", "points": 10, "kind": "photo" }
  ]
}
points는 10~20 정수. 가능하면 kind를 다양하게.`,
        },
      ],
    })
  );

  const parsed = extractJsonObject(result.content) as {
    headline?: string;
    companionNote?: string;
    quests?: Array<{
      emoji?: string;
      title?: string;
      hint?: string;
      points?: number;
      kind?: string;
    }>;
  };

  const quests = (parsed.quests ?? [])
    .filter((q) => q.title?.trim())
    .slice(0, 3)
    .map((q, index) =>
      normalizePackQuest(
        {
          emoji: q.emoji,
          title: q.title!,
          hint: q.hint,
          points: q.points,
          kind: q.kind,
        },
        input.date,
        index
      )
    );

  if (quests.length < 3) return null;

  return {
    userId: input.userId,
    date: input.date,
    scene: input.plan.scene,
    headline: parsed.headline?.trim() || "🌈 오늘의 작은 모험",
    companionNote:
      parsed.companionNote?.trim() ||
      input.plan.reasoning ||
      "오늘 상태와 병원에 맞춰 작은 모험을 골랐어요.",
    factors: buildFactorChips(input.context, input.plan.scene),
    context: input.context,
    quests,
    generatedBy: input.problems?.length ? "llm-repaired" : "llm",
    plan: input.plan,
  };
}

/**
 * AI Agent — Today's Mission.
 * plan(LLM) → conditional tool call → generate(LLM) → validate(pure) → repair(LLM, max 1) → rule fallback
 */
export async function runMissionAgent(
  userId: string,
  date: string,
  context: AdventureContextFactors
): Promise<AdventureDayPack> {
  const { result, trace } = await runPipeline(
    { feature: "agent.mission", kind: "agent" },
    async (run) => {
      const plan = await planMission(run, context, date);

      let avoidTitles: string[] = [];
      if (plan.needsRecentHistory) {
        avoidTitles =
          (await run.stepSafe("agent.mission.tool.recent_history", () =>
            loadRecentQuestTitles(userId, date)
          )) ?? [];
      } else {
        run.note("agent.mission.tool.recent_history", "skipped_by_plan");
      }

      let attempts = 0;
      let pack = await generatePack(run, {
        userId,
        date,
        context,
        plan,
        avoidTitles,
        feature: "agent.mission.generate",
      });
      attempts += 1;
      recordCount("AgentLoopIterations", 1, {
        feature: "agent.mission",
        operation: "generate",
      });

      if (pack) {
        const v = validatePack(pack.quests, plan, avoidTitles);
        if (!v.ok) {
          run.note("validate", v.problems.join("; "));
          if (run.remainingMs() > 4000) {
            recordCount("AgentRepairs", 1, {
              feature: "agent.mission",
              operation: "repair",
            });
            pack = await generatePack(run, {
              userId,
              date,
              context,
              plan,
              avoidTitles,
              problems: v.problems,
              feature: "agent.mission.generate",
            });
            attempts += 1;
            recordCount("AgentLoopIterations", 1, {
              feature: "agent.mission",
              operation: "repair",
            });
            if (pack) {
              const v2 = validatePack(pack.quests, plan, avoidTitles);
              if (!v2.ok) {
                run.note("validate_after_repair", v2.problems.join("; "));
                pack = null;
              }
            }
          } else {
            pack = null;
          }
        }
      }

      if (!pack) {
        recordCount("AgentFallbacks", 1, {
          feature: "agent.mission",
          operation: "rules",
        });
        run.note("fallback", "buildRuleBasedPack");
        const scene = plan.scene;
        const rules = buildRuleBasedPack(userId, date, scene, context);
        return {
          ...rules,
          plan,
          generatedBy: "rules" as const,
        };
      }

      return { ...pack, plan, agentTrace: undefined };
    }
  );

  return { ...result, agentTrace: trace };
}
