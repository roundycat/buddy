import "server-only";
import {
  runLlm,
  runPipeline,
  runToolAgent,
  type AgentTool,
  type AiPurpose,
  type RunHandle,
} from "@/backend/ai/orchestrator";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { env } from "@/backend/shared/config/env";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";
import { recordCount } from "@/backend/shared/observability";
import { getChildName } from "@/backend/features/persona/persona.store";
import {
  MISSION_TOOL_SPECS,
  runLookupGuidanceTool,
  runRecentTitlesTool,
  TOOL_LOOKUP_GUIDANCE,
  TOOL_RECENT_TITLES,
  TOOL_SUBMIT_PLAN,
} from "./adventure-quest.tools";
import { listAdventurePacksForUser } from "./adventure-quest.store";
import {
  buildFactorChips,
  buildRuleBasedPack,
  isConnectQuest,
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
      ? "오늘 검사·치료 일정이 있어 부담이 적은 짧은 실내 모험으로 잡았어요."
      : scene === "low_energy"
        ? "에너지가 낮아 보여 쉬는 날 맞춤 모험으로 골랐어요."
        : scene === "rainy"
          ? "비 오는 날이라 실내 위주 모험을 골랐어요."
          : "맑은 날 병실에서도 할 수 있는 가벼운 모험을 골랐어요.";

  return { reasoning, focusSignals, avoid };
}

function rulesPlan(
  context: AdventureContextFactors,
  detail: string,
  run: RunHandle
): MissionPlan {
  const scene = resolveScene(context);
  const r = ruleReasoning(scene, context);
  run.note("plan", detail);
  return {
    scene,
    ...r,
    questKinds: ["photo", "chat", "observe"],
    needsRecentHistory: false,
    needsGuidanceDocs: false,
    plannedBy: "rules",
    toolCalls: [],
  };
}

function buildMissionTools(userId: string, date: string): AgentTool[] {
  const byName = new Map(MISSION_TOOL_SPECS.map((s) => [s.name, s]));
  return [
    {
      spec: byName.get(TOOL_LOOKUP_GUIDANCE)!,
      run: async (input) => runLookupGuidanceTool(input),
    },
    {
      spec: byName.get(TOOL_RECENT_TITLES)!,
      run: async (input) => runRecentTitlesTool(userId, date, input),
    },
    {
      spec: byName.get(TOOL_SUBMIT_PLAN)!,
      // Terminal — input is the MissionPlan; run is never invoked.
      run: async (input) => input,
      terminal: true,
    },
  ];
}

function normalizeSubmittedPlan(
  submitted: Record<string, unknown>,
  toolCalls: string[]
): MissionPlan | null {
  const scene = String(submitted.scene ?? "");
  if (!SCENES.has(scene as AdventureScene)) return null;

  const kinds = (Array.isArray(submitted.questKinds) ? submitted.questKinds : [])
    .map(String)
    .filter((k): k is AdventureQuestKind =>
      ["photo", "garden", "chat", "post", "observe"].includes(k)
    );

  const usedGuidance = toolCalls.includes(TOOL_LOOKUP_GUIDANCE);
  const usedRecent = toolCalls.includes(TOOL_RECENT_TITLES);

  return {
    scene: scene as AdventureScene,
    reasoning:
      String(submitted.reasoning ?? "").trim() ||
      "컨텍스트에 맞춰 장면을 골랐어요.",
    focusSignals: (Array.isArray(submitted.focusSignals)
      ? submitted.focusSignals
      : []
    )
      .map(String)
      .slice(0, 6),
    avoid: (Array.isArray(submitted.avoid) ? submitted.avoid : [])
      .map(String)
      .slice(0, 6),
    questKinds: kinds.length ? kinds.slice(0, 3) : ["photo", "chat", "observe"],
    needsRecentHistory: usedRecent,
    needsGuidanceDocs: usedGuidance,
    plannedBy: "tool-use",
    toolCalls,
  };
}

function titlesFromToolCalls(
  calls: Array<{ name: string; ok: boolean; output?: unknown }>
): string[] {
  const hit = [...calls]
    .reverse()
    .find((c) => c.name === TOOL_RECENT_TITLES && c.ok);
  if (!hit || !hit.output || typeof hit.output !== "object") return [];
  const titles = (hit.output as { titles?: unknown }).titles;
  if (!Array.isArray(titles)) return [];
  return titles.map(String).filter(Boolean).slice(0, 21);
}

/**
 * Plan phase — Bedrock tool-use agent.
 * Model may call guidance / recent-titles tools, then must submit_mission_plan.
 */
async function planMission(
  run: RunHandle,
  userId: string,
  context: AdventureContextFactors,
  date: string
): Promise<{ plan: MissionPlan; avoidTitles: string[] }> {
  if (env.llmProvider === "mock") {
    return { plan: rulesPlan(context, "fallback_to_rules_mock", run), avoidTitles: [] };
  }

  const childName = await getChildName(userId);

  const outcome = await run.stepSafe("agent.mission.plan", async () =>
    runToolAgent({
      feature: "agent.mission.plan",
      purpose: PLAN_PURPOSE,
      childName,
      maxIterations: 5,
      budgetMs: Math.min(10_000, Math.max(3_000, run.remainingMs())),
      temperature: 0.3,
      maxTokens: 500,
      tools: buildMissionTools(userId, date),
      system: withBeddySafety(`당신은 Beddy 미션 Agent의 계획기입니다.
입원 청소년용 "오늘의 작은 모험" 장면을 고릅니다.

도구:
- ${TOOL_LOOKUP_GUIDANCE}: 치료 불안·낮은 에너지·고립감처럼 정서 배려가 필요한 날에만.
- ${TOOL_RECENT_TITLES}: 제목 중복을 피해야 할 때만.
- ${TOOL_SUBMIT_PLAN}: 필요한 도구를 쓴 뒤 마지막에 반드시 한 번 호출해 계획을 확정.

규칙:
- 의료·진단·처방 금지. 병실·침대 근처에서 할 수 있는 활동만.
- 야외·무리한 활동은 avoid에 넣으세요.
- questKinds는 photo|garden|chat|post|observe 중 서로 다르게 최대 3개.
- 3개 중 1개는 사람과 마음을 나누는 '사람 연결' 미션이 되도록 observe를 포함하세요.`),
      task: `날짜: ${date}
아이 이름: ${childName ?? "(미상)"}
오늘의 컨텍스트(JSON):
${JSON.stringify(context, null, 2)}

위 컨텍스트를 보고 필요한 도구를 고른 뒤, ${TOOL_SUBMIT_PLAN}으로 오늘의 미션 계획을 제출하세요.`,
    })
  );

  if (!outcome) {
    return {
      plan: rulesPlan(context, "fallback_to_rules_plan_error", run),
      avoidTitles: [],
    };
  }

  for (const step of outcome.trace) {
    run.note(step.step, step.detail ?? (step.ok ? "ok" : "fail"));
  }

  const toolCallNames = outcome.toolCalls.map((c) => c.name);
  run.note(
    "agent.mission.tool_calls",
    toolCallNames.length ? toolCallNames.join(",") : "none"
  );

  if (outcome.exhausted) {
    recordCount("AgentFallbacks", 1, {
      feature: "agent.mission",
      operation: "plan_exhausted",
    });
  }

  const avoidTitles = titlesFromToolCalls(outcome.toolCalls);

  if (!outcome.submitted) {
    return {
      plan: rulesPlan(context, "fallback_to_rules_no_submit", run),
      avoidTitles,
    };
  }

  const plan = normalizeSubmittedPlan(outcome.submitted, toolCallNames);
  if (!plan) {
    return {
      plan: rulesPlan(context, "fallback_to_rules_bad_submit", run),
      avoidTitles,
    };
  }

  let titles = avoidTitles;
  if (!titles.length && plan.needsRecentHistory) {
    titles =
      (await run.stepSafe("agent.mission.tool.recent_history", () =>
        loadRecentQuestTitles(userId, date)
      )) ?? [];
  } else if (!toolCallNames.includes(TOOL_RECENT_TITLES)) {
    run.note("agent.mission.tool.recent_history", "skipped_by_model");
  }

  if (!toolCallNames.includes(TOOL_LOOKUP_GUIDANCE)) {
    run.note("agent.mission.tool.guidance", "skipped_by_model");
  }

  return { plan, avoidTitles: titles };
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

  if (!quests.some((q) => isConnectQuest(q.title, q.hint))) {
    problems.push(
      "사람 연결 미션이 없습니다. 간호사·가족·친구 같은 실제 사람과 마음을 나누는 미션을 1개 넣어 주세요."
    );
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

  // A failed or malformed generation returns null → validate/repair → rule fallback.
  const result = await run.stepSafe("agent.mission.generate", async () =>
    runLlm({
      feature: input.feature,
      childFacing: true,
      purpose: GENERATE_PURPOSE,
      childName: await getChildName(input.userId),
      temperature: 0.7,
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 입원 청소년을 위한 앱 Beddy의 오늘의 모험 Agent입니다.
병실·복도·침대 근처에서 할 수 있는 작고 즐거운 모험을 제안하세요.
각 모험은 앱 안에서 할 수 있어야 합니다. kind는 photo|garden|chat|post|observe 중 하나.
3개 중 정확히 1개는 '사람 연결' 미션입니다: 간호사·의사 선생님, 가족·보호자, 병원학교 선생님·친구 같은 실제 사람에게
한마디 건네거나 고마움·기분을 전하고, 어땠는지 한 줄 남기는 활동(kind: observe). 베디(AI)와의 대화는 사람 연결이 아닙니다.
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

  if (!result) return null;

  let parsed: {
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
  try {
    parsed = extractJsonObject(result.content) as typeof parsed;
  } catch {
    run.note("generate_parse", "reply had no JSON object");
    return null;
  }

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
 * tool-use plan → generate(LLM) → validate(pure) → repair(LLM, max 1) → rule fallback
 */
export async function runMissionAgent(
  userId: string,
  date: string,
  context: AdventureContextFactors
): Promise<AdventureDayPack> {
  const { result, trace } = await runPipeline(
    { feature: "agent.mission", kind: "agent", budgetMs: 20_000 },
    async (run) => {
      const { plan, avoidTitles } = await planMission(
        run,
        userId,
        context,
        date
      );

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
