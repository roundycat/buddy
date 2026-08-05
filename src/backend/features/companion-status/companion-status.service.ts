import { runLlm } from "@/backend/ai/orchestrator";
import { env } from "@/backend/shared/config/env";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";
import { todayKey } from "@/backend/shared/time/date";
import { getConversationMemory } from "@/backend/features/conversation/conversation.store";
import { getGardenAccount } from "@/backend/features/emotion-garden/emotion-garden.store";
import { MOOD_OPTIONS } from "@/backend/features/emotion-garden/emotion-garden.service";
import type { MoodId } from "@/backend/features/emotion-garden/emotion-garden.types";
import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import { getWishTreeAccount } from "@/backend/features/wish-tree/wish-tree.store";
import { getAdventurePack } from "@/backend/features/adventure-quest/adventure-quest.store";
import { resolveLinkedChildUserId } from "@/backend/features/guardian-link/guardian-link.service";
import type {
  CompanionConditionLevel,
  CompanionConditionSignal,
  CompanionNeedRecommendation,
  CompanionStatusDashboard,
} from "./companion-status.types";

function moodLevel(mood: MoodId | null): CompanionConditionLevel {
  if (!mood) return "medium";
  if (mood === "happy" || mood === "love") return "high";
  if (mood === "sleepy") return "medium";
  return "low";
}

function energyLevel(params: {
  mood: MoodId | null;
  personaEnergy?: string;
  scene?: string | null;
}): CompanionConditionLevel {
  if (params.scene === "low_energy" || params.personaEnergy === "low") {
    return "low";
  }
  if (
    params.mood === "sleepy" ||
    params.mood === "sad" ||
    params.mood === "angry"
  ) {
    return "low";
  }
  if (params.personaEnergy === "high" || params.mood === "happy") return "high";
  return "medium";
}

function connectionLevel(turnCount: number): CompanionConditionLevel {
  if (turnCount <= 0) return "low";
  if (turnCount < 6) return "medium";
  return "high";
}

function hopeLevel(wishCount: number): CompanionConditionLevel {
  if (wishCount <= 0) return "low";
  if (wishCount < 3) return "medium";
  return "high";
}

function buildSignals(input: {
  mood: MoodId | null;
  flowerName?: string;
  personaEnergy?: string;
  scene?: string | null;
  sceneHeadline?: string | null;
  turnCount: number;
  themes: string[];
  wishCount: number;
}): CompanionConditionSignal[] {
  const moodMeta = input.mood
    ? MOOD_OPTIONS.find((m) => m.id === input.mood)
    : null;

  const moodHint = input.mood
    ? `감정 정원 · ${input.flowerName ?? moodMeta?.label ?? "오늘의 꽃"}`
    : "아직 오늘 꽃을 심지 않았어요";

  const energyHint =
    input.scene === "low_energy"
      ? "모험도 쉬는 날 세트로 맞춰짐"
      : input.personaEnergy === "low"
        ? "온보딩 에너지가 낮음으로 잡혀 있어요"
        : input.sceneHeadline
          ? `오늘의 모험 · ${input.sceneHeadline}`
          : "모험 기록이 아직 없어요";

  const connectionHint =
    input.turnCount <= 0
      ? "아직 베디와 대화를 시작하지 않았어요"
      : input.themes.length > 0
        ? `대화 테마 · ${input.themes.slice(0, 2).join(", ")}`
        : input.turnCount < 6
          ? "짧게라도 베디와 이야기함"
          : `${input.turnCount}번의 대화로 조금씩 알아가는 중`;

  const hopeHint =
    input.wishCount <= 0
      ? "소원 나무에 아직 꿈이 없어요"
      : `소원 나무에 꿈 ${input.wishCount}개가 걸려 있음`;

  return [
    {
      id: "mood",
      label: "오늘의 기분",
      level: moodLevel(input.mood),
      hint: moodHint,
      emoji: moodMeta?.emoji ?? "🌱",
    },
    {
      id: "energy",
      label: "에너지감",
      level: energyLevel({
        mood: input.mood,
        personaEnergy: input.personaEnergy,
        scene: input.scene,
      }),
      hint: energyHint,
      emoji: "🫧",
    },
    {
      id: "connection",
      label: "대화 연결",
      level: connectionLevel(input.turnCount),
      hint: connectionHint,
      emoji: "💬",
    },
    {
      id: "hope",
      label: "희망 신호",
      level: hopeLevel(input.wishCount),
      hint: hopeHint,
      emoji: "🌟",
    },
  ];
}

function ruleBasedOverall(signals: CompanionConditionSignal[]): {
  overallLabel: string;
  overallHint: string;
} {
  const score = signals.reduce((sum, s) => {
    if (s.level === "low") return sum + 0;
    if (s.level === "medium") return sum + 1;
    return sum + 2;
  }, 0);

  const mood = signals.find((s) => s.id === "mood");
  const energy = signals.find((s) => s.id === "energy");
  const connection = signals.find((s) => s.id === "connection");
  const hope = signals.find((s) => s.id === "hope");

  if (score <= 3) {
    return {
      overallLabel: "조금 지쳐 보이는 하루",
      overallHint: [
        mood?.hint,
        energy?.level === "low" ? "쉬는 쪽을 고르는 흐름이에요." : null,
        connection?.level === "low"
          ? "대화는 아직 적지만, 옆에 있어 주는 것만으로도 충분할 수 있어요."
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  if (score >= 7) {
    return {
      overallLabel: "마음 결이 비교적 밝은 하루",
      overallHint: [
        hope?.level === "high" ? "소원이 하루를 붙잡고 있어요." : null,
        connection?.level === "high"
          ? "베디와의 이야기도 이어지고 있어요."
          : null,
        mood?.hint,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  return {
    overallLabel: "잔잔하게 흘러가는 하루",
    overallHint: [mood?.hint, hope?.hint, connection?.hint]
      .filter(Boolean)
      .join(" "),
  };
}

function buildRecommendations(
  signals: CompanionConditionSignal[],
  themes: string[],
  wishPreview?: string
): CompanionNeedRecommendation[] {
  const byId = Object.fromEntries(signals.map((s) => [s.id, s]));
  const recs: CompanionNeedRecommendation[] = [];

  if (byId.energy?.level === "low" || byId.mood?.level === "low") {
    recs.push({
      id: "rec-rest",
      title: "짧게 곁에 있어 주기",
      reason:
        "컨디션이 낮은 날에는 긴 대화보다, ‘여기 있어’가 더 잘 닿아요.",
      actionHint: "5분만 같이 앉아 있거나, 손 한 번 잡아 주기",
      sources: [
        byId.mood?.hint ?? "오늘의 기분",
        byId.energy?.hint ?? "에너지감",
      ],
      priority: "now",
    });
  }

  if (byId.connection?.level === "low") {
    recs.push({
      id: "rec-chat",
      title: "베디에게 한마디만 열어 주기",
      reason: "대화 연결이 아직 얇아요. 짧은 인사만으로도 하루가 이어져요.",
      actionHint: "‘오늘 어땠어?’보다 ‘나 여기 있어’가 더 편할 수 있어요",
      sources: ["대화 메모리", ...themes.slice(0, 1)],
      priority: "today",
    });
  } else if (themes.length > 0) {
    recs.push({
      id: "rec-theme",
      title: "이야기 이어 주기",
      reason: `요즘 대화에서 ‘${themes[0]}’ 결이 보여요. 같은 주제로 가볍게 이어가 보세요.`,
      actionHint: "질문보다 공감 한 줄 — ‘그랬구나’",
      sources: ["LLM 대화 메모리", themes[0]],
      priority: "today",
    });
  }

  if (byId.hope?.level !== "low") {
    recs.push({
      id: "rec-wish",
      title: "소원 하나 함께 꺼내 보기",
      reason: wishPreview
        ? `소원 나무에 ‘${wishPreview}’가 걸려 있어요. 퇴원 희망을 붙잡는 실이 됩니다.`
        : "소원 나무의 꿈이 희망을 붙잡고 있어요.",
      actionHint: "‘퇴원하면 뭐 하고 싶어?’를 가볍게 물어보기",
      sources: ["소원 나무", "성장 스토리북"],
      priority: "soft",
    });
  } else {
    recs.push({
      id: "rec-plant-hope",
      title: "작은 소원 하나 심어 보기",
      reason: "희망 신호가 아직 비어 있어요. 아주 작은 꿈도 충분해요.",
      actionHint: "아이와 함께 소원 나무에 한 줄만 걸어 보기",
      sources: ["소원 나무"],
      priority: "soft",
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: "rec-default",
      title: "오늘도 같은 자리에",
      reason: "특별한 처방보다, 익숙한 리듬이 아이를 안심하게 해요.",
      actionHint: "평소처럼 짧게 인사하고 옆에 있어 주기",
      sources: ["생활 신호"],
      priority: "soft",
    });
  }

  return recs.slice(0, 3);
}

async function maybePolishWithLlm(params: {
  childName: string;
  signals: CompanionConditionSignal[];
  themes: string[];
  facts: string[];
  fallback: { overallLabel: string; overallHint: string };
}): Promise<{ overallLabel: string; overallHint: string }> {
  if (env.llmProvider === "mock") return params.fallback;

  try {
    const result = await runLlm({
      feature: "companion.status",
      purpose: "analysis",
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 병원 아이 돌봄 동반자 베디의 보호자용 요약가입니다.
생활·감정 신호를 편하게 요약하고, 보호자가 이해하기 쉬운 말투로 씁니다.
JSON만 반환: {"overallLabel":"짧은 제목","overallHint":"2~4문장"}`),
        },
        {
          role: "user",
          content: JSON.stringify({
            childName: params.childName,
            signals: params.signals,
            emotionalThemes: params.themes,
            importantFacts: params.facts.slice(0, 5),
          }),
        },
      ],
      temperature: 0.4,
      maxTokens: 220,
    });

    const parsed = extractJsonObject(result.content) as {
      overallLabel?: string;
      overallHint?: string;
    };

    if (parsed?.overallLabel && parsed?.overallHint) {
      return {
        overallLabel: parsed.overallLabel.slice(0, 40),
        overallHint: parsed.overallHint.slice(0, 160),
      };
    }
  } catch (error) {
    console.warn("[companion-status] LLM polish skipped", error);
  }

  return params.fallback;
}

export async function getCompanionStatusDashboard(
  guardianUserId?: string
): Promise<CompanionStatusDashboard> {
  const childUserId = await resolveLinkedChildUserId(guardianUserId);

  if (!childUserId) {
    return {
      linked: false,
      childUserId: null,
      childName: "아이",
      dayCount: 0,
      updatedLabel: "아직 연결되지 않음",
      companionNote:
        "아이 대기실에 있는 초대 코드를 입력하면, 오늘의 생활 신호가 여기에 모여요.",
      condition: {
        overallLabel: "아이를 연결해 주세요",
        overallHint: "보호자 로그인 후, 아이가 보여 준 6자리 코드를 입력해요.",
        signals: [],
      },
      recommendations: [],
      ragStatus: "mock",
      sourceSummary: {
        hasTodayMood: false,
        chatTurns: 0,
        wishCount: 0,
        adventureScene: null,
        emotionalThemes: [],
      },
    };
  }

  const persona = await getPersonaForUser(childUserId);
  const garden = await getGardenAccount(childUserId);
  const memory = await getConversationMemory(childUserId);
  const wishes = (await getWishTreeAccount(childUserId)).wishes;
  const date = todayKey();
  const todayPack = await getAdventurePack(childUserId, date);
  const todayFlower = garden.flowers.find((f) => f.plantedOn === date);
  const childName =
    persona.self?.nickname?.trim() ||
    persona.callName ||
    persona.name ||
    "아이";

  const signals = buildSignals({
    mood: todayFlower?.mood ?? null,
    flowerName: todayFlower?.name,
    personaEnergy: persona.energy,
    scene: todayPack?.scene ?? null,
    sceneHeadline: todayPack?.headline ?? null,
    turnCount: memory.turnCount,
    themes: memory.emotionalThemes,
    wishCount: wishes.length,
  });

  const fallback = ruleBasedOverall(signals);
  const overall = await maybePolishWithLlm({
    childName,
    signals,
    themes: memory.emotionalThemes,
    facts: memory.importantFacts,
    fallback,
  });

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return {
    linked: true,
    childUserId,
    childName,
    dayCount: persona.dayCount ?? 1,
    updatedLabel: `오늘 ${hh}:${mm} 기준 · 아이 기록 연동`,
    companionNote:
      "의료 진단이 아니라, 아이 계정의 감정 정원·대화 메모리·소원·모험을 모은 부드러운 생활 신호예요.",
    condition: {
      overallLabel: overall.overallLabel,
      overallHint: overall.overallHint,
      signals,
    },
    recommendations: buildRecommendations(
      signals,
      memory.emotionalThemes,
      wishes[0]?.text
    ),
    ragStatus: "live",
    sourceSummary: {
      hasTodayMood: Boolean(todayFlower),
      chatTurns: memory.turnCount,
      wishCount: wishes.length,
      adventureScene: todayPack?.scene ?? null,
      emotionalThemes: memory.emotionalThemes,
    },
  };
}
