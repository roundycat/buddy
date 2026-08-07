import "server-only";
import type { LlmToolSpec } from "@/backend/shared/llm/types";
import {
  lookupEmotionalGuidance,
  type EmotionalGuidanceCard,
} from "@/backend/ai/agent/guidance/lookup-emotional-guidance";
import { listAdventurePacksForUser } from "./adventure-quest.store";

/**
 * Tool catalogue for the Today's Mission Agent.
 * The model reads these specs and decides which to call; nothing here routes
 * requests between AI components.
 */

export const TOOL_LOOKUP_GUIDANCE = "lookup_emotional_guidance";
export const TOOL_RECENT_TITLES = "list_recent_quest_titles";
export const TOOL_SUBMIT_PLAN = "submit_mission_plan";

export const MISSION_TOOL_SPECS: LlmToolSpec[] = [
  {
    name: TOOL_LOOKUP_GUIDANCE,
    description:
      "입원 아동 심리·정서 지원 연구에서 뽑은 실천 원칙 카드를 검색합니다. " +
      "치료 불안, 낮은 에너지, 고립감, 자기표현처럼 정서적 배려가 필요한 날에만 부르세요. " +
      "의료 조언이 아니라 활동 설계 원칙입니다.",
    inputSchema: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          description: "찾을 주제 태그",
          items: {
            type: "string",
            enum: [
              "isolation",
              "treatment_anxiety",
              "self_expression",
              "play",
              "low_energy",
              "hospital_routine",
              "family_bond",
            ],
          },
        },
        limit: {
          type: "integer",
          description: "가져올 카드 수 (1~5, 기본 3)",
        },
      },
      required: ["tags"],
    },
  },
  {
    name: TOOL_RECENT_TITLES,
    description:
      "이 아이에게 최근에 나갔던 미션 제목을 가져옵니다. " +
      "제목이 겹치지 않게 해야 할 때만 부르세요.",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "거슬러 볼 일수 (1~14, 기본 7)",
        },
      },
      required: [],
    },
  },
  {
    name: TOOL_SUBMIT_PLAN,
    description:
      "오늘의 미션 계획을 확정합니다. 필요한 도구를 모두 쓴 뒤 마지막에 한 번 부르세요.",
    inputSchema: {
      type: "object",
      properties: {
        scene: {
          type: "string",
          enum: ["sunny", "rainy", "treatment", "low_energy"],
          description: "오늘의 장면 유형",
        },
        reasoning: {
          type: "string",
          description: "왜 이 장면인지 1~2문장",
        },
        focusSignals: {
          type: "array",
          items: { type: "string" },
          description: "근거로 삼은 신호. 예: 치료 일정 2건, 낮은 에너지",
        },
        avoid: {
          type: "array",
          items: { type: "string" },
          description: "오늘 피할 것. 예: 야외 활동, 체력 소모",
        },
        questKinds: {
          type: "array",
          items: {
            type: "string",
            enum: ["photo", "garden", "chat", "post", "observe"],
          },
          description: "미션 3개에 쓸 kind 배분. 가능하면 서로 다르게",
        },
      },
      required: ["scene", "reasoning", "focusSignals", "avoid", "questKinds"],
    },
  },
];

export interface GuidanceToolOutput {
  cards: EmotionalGuidanceCard[];
}

export function runLookupGuidanceTool(input: {
  tags?: unknown;
  limit?: unknown;
}): GuidanceToolOutput {
  const tags = Array.isArray(input.tags) ? input.tags.map(String) : [];
  const limit =
    typeof input.limit === "number" && Number.isFinite(input.limit)
      ? input.limit
      : 3;
  return { cards: lookupEmotionalGuidance({ tags, limit }) };
}

export async function runRecentTitlesTool(
  userId: string,
  date: string,
  input: { days?: unknown }
): Promise<{ titles: string[] }> {
  const days =
    typeof input.days === "number" && Number.isFinite(input.days)
      ? Math.min(14, Math.max(1, Math.round(input.days)))
      : 7;

  const packs = await listAdventurePacksForUser(userId);
  const cutoff =
    new Date(`${date}T00:00:00+09:00`).getTime() - days * 86_400_000;

  const titles: string[] = [];
  for (const pack of packs) {
    const t = new Date(`${pack.date}T00:00:00+09:00`).getTime();
    if (!Number.isFinite(t) || t < cutoff || pack.date === date) continue;
    for (const quest of pack.quests) {
      if (quest.title?.trim()) titles.push(quest.title.trim());
    }
  }

  return { titles: Array.from(new Set(titles)).slice(0, 21) };
}
