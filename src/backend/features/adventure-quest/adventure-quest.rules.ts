import type {
  AdventureContextFactors,
  AdventureDayPack,
  AdventureQuestKind,
  AdventureScene,
} from "./adventure-quest.types";

type SeedQuest = {
  emoji: string;
  title: string;
  hint: string;
  points: number;
  kind: AdventureQuestKind;
};

function pickInterest(interests: string[]): string | null {
  if (interests.length === 0) return null;
  return interests[0];
}

function withInterest(title: string, interest: string | null): string {
  if (!interest) return title;
  if (title.includes("좋아하는")) {
    return title.replace("좋아하는", `${interest} 좋아하는`);
  }
  return title;
}

/**
 * Curated packs — each quest maps to an in-app activity kind.
 */
export function buildRuleBasedPack(
  userId: string,
  date: string,
  scene: AdventureScene,
  context: AdventureContextFactors
): AdventureDayPack {
  const interest = pickInterest(context.interests);
  const outdoor = context.ward.outdoorOk;

  const packs: Record<
    AdventureScene,
    { headline: string; note: string; quests: SeedQuest[] }
  > = {
    sunny: {
      headline: "☀️ 오늘은 햇살이 좋아!",
      note: "맑은 날에 맞춰, 몸과 마음이 가벼운 작은 모험을 골랐어요.",
      quests: [
        {
          emoji: "🌳",
          title: outdoor
            ? "병원 정원에서 하늘 사진 남기기"
            : "창밖으로 하늘 사진 남기기",
          hint: "사진을 올려 사진첩에 남겨 주세요.",
          points: 12,
          kind: "photo",
        },
        {
          emoji: "🎵",
          title: withInterest("가장 좋아하는 노래 이야기하기", interest),
          hint: "대기실에서 베디에게 노래 이야기를 들려주세요.",
          points: 10,
          kind: "chat",
        },
        {
          emoji: "🌱",
          title: "오늘 기분을 정원에 심기",
          hint: "감정 정원에서 오늘의 꽃을 심어 보세요.",
          points: 12,
          kind: "garden",
        },
      ],
    },
    rainy: {
      headline: "🌧️ 오늘은 비가 와.",
      note: "비 오는 날은 밖으로 나가지 않아도 되는 모험으로 채웠어요.",
      quests: [
        {
          emoji: "☔",
          title: "빗소리 들으며 한 줄 남기기",
          hint: "들은 느낌을 짧게 적거나 사진을 남겨도 좋아요.",
          points: 10,
          kind: "observe",
        },
        {
          emoji: "🎨",
          title: interest
            ? `비 오는 날의 ${interest} 그림 사진 남기기`
            : "비 오는 날 그림 사진 남기기",
          hint: "그린 것을 사진으로 올려 사진첩에 저장해요.",
          points: 12,
          kind: "photo",
        },
        {
          emoji: "📖",
          title: "베디와 비 오는 동화 읽기",
          hint: "대기실에서 베디에게 ‘비 오는 이야기’를 들려달라고 해 보세요.",
          points: 15,
          kind: "chat",
        },
      ],
    },
    treatment: {
      headline: "💉 오늘은 검사 있는 날!",
      note: "치료·검사가 있는 날엔 용기와 위로가 먼저예요.",
      quests: [
        {
          emoji: "💪",
          title: "검사 후 용기 한마디 남기기",
          hint: "짧은 메모로 용기를 남겨 주세요.",
          points: 20,
          kind: "observe",
        },
        {
          emoji: "🌸",
          title: "오늘 기분을 정원에 심기",
          hint: "감정 정원에서 지금 기분을 꽃으로 남겨 보세요.",
          points: 10,
          kind: "garden",
        },
        {
          emoji: "✉️",
          title: "미래의 나에게 한 줄 편지",
          hint: "우체국에서 짧은 편지를 남겨 보세요.",
          points: 15,
          kind: "post",
        },
      ],
    },
    low_energy: {
      headline: "🤒 오늘은 조금 쉬어가는 날.",
      note: "컨디션이 좋지 않을 땐, 아주 작은 모험만 해도 충분해요.",
      quests: [
        {
          emoji: "🫧",
          title: "숨 고르고 기분 남기기",
          hint: "감정 정원에서 지금 기분을 가볍게 심어 보세요.",
          points: 10,
          kind: "garden",
        },
        {
          emoji: "🎧",
          title: withInterest("좋아하는 음악 이야기하기", interest),
          hint: "대기실에서 베디에게 한 곡만 이야기해 주세요.",
          points: 10,
          kind: "chat",
        },
        {
          emoji: "📷",
          title: "오늘 마음에 드는 사진 한 장",
          hint: "사진을 올려 사진첩에 남겨 주세요.",
          points: 12,
          kind: "photo",
        },
      ],
    },
  };

  const pack = packs[scene];
  const quests = pack.quests.map((q, index) => ({
    id: `aq-${date}-${index}`,
    ...q,
    progress: {},
  }));

  return {
    userId,
    date,
    scene,
    headline: pack.headline,
    companionNote: pack.note,
    factors: buildFactorChips(context, scene),
    context,
    quests,
    generatedBy: "rules",
  };
}

export function buildFactorChips(
  context: AdventureContextFactors,
  scene: AdventureScene
): Array<{ emoji: string; label: string }> {
  const chips: Array<{ emoji: string; label: string }> = [
    { emoji: context.weather.emoji, label: context.weather.label },
    { emoji: "🏥", label: context.ward.label },
  ];

  if (context.mood.id) {
    chips.push({
      emoji: context.mood.emoji,
      label: `기분 · ${context.mood.label}`,
    });
  }
  if (context.age != null) {
    chips.push({ emoji: "👶", label: `만 ${context.age}세` });
  }
  if (context.interests[0]) {
    chips.push({ emoji: "❤️", label: context.interests[0] });
  }
  if (context.schedule.hasTreatment) {
    chips.push({
      emoji: "📅",
      label: context.schedule.labels[0] ?? "치료 일정",
    });
  }
  if (context.memory.turnCount > 0) {
    chips.push({
      emoji: "💬",
      label:
        context.memory.emotionalThemes[0] ??
        `대화 ${context.memory.turnCount}턴`,
    });
  }
  if (context.guardian.linked) {
    chips.push({
      emoji: "👨‍👩‍👧",
      label: `보호자 연결 ${context.guardian.count}명`,
    });
  }

  const sceneHint: Record<AdventureScene, string> = {
    sunny: "맑은 날 맞춤",
    rainy: "비 오는 날 맞춤",
    treatment: "검사·치료 날 맞춤",
    low_energy: "쉬는 날 맞춤",
  };
  chips.push({ emoji: "🌈", label: sceneHint[scene] });

  return chips.slice(0, 7);
}

export function resolveScene(
  context: AdventureContextFactors
): AdventureScene {
  if (context.schedule.hasTreatment) return "treatment";

  const lowMoods = new Set(["sad", "sleepy", "angry"]);
  if (
    (context.mood.id && lowMoods.has(context.mood.id)) ||
    context.energy === "low"
  ) {
    return "low_energy";
  }

  if (context.weather.code === "rainy") return "rainy";
  return "sunny";
}

export function actionHrefFor(
  kind: AdventureQuestKind,
  questId: string
): string {
  const q = encodeURIComponent(questId);
  switch (kind) {
    case "garden":
      return `/garden?quest=${q}`;
    case "chat":
      return `/?quest=${q}`;
    case "post":
      return `/post?quest=${q}`;
    case "photo":
    case "observe":
    default:
      return `/adventure?quest=${q}`;
  }
}

const KIND_SET = new Set<AdventureQuestKind>([
  "photo",
  "garden",
  "chat",
  "post",
  "observe",
]);

export function normalizeQuestKind(
  raw: unknown,
  title = "",
  hint = ""
): AdventureQuestKind {
  if (typeof raw === "string" && KIND_SET.has(raw as AdventureQuestKind)) {
    return raw as AdventureQuestKind;
  }
  const blob = `${title} ${hint}`.toLowerCase();
  if (/사진|찍어|올려|카메라|하늘|그림/.test(blob)) return "photo";
  if (/정원|기분|꽃|숨/.test(blob)) return "garden";
  if (/편지|우체|메시지|미래/.test(blob)) return "post";
  if (/베디|대화|이야기|노래|동화|말하/.test(blob)) return "chat";
  return "observe";
}

export function isQuestReadyToClaim(input: {
  kind: AdventureQuestKind;
  progress?: { completedAt?: string; photoId?: string; note?: string };
}): boolean {
  const p = input.progress ?? {};
  switch (input.kind) {
    case "photo":
      return Boolean(p.photoId);
    case "observe":
      return Boolean(p.photoId || (p.note && p.note.trim().length > 0));
    case "garden":
    case "chat":
    case "post":
      return Boolean(p.completedAt);
    default:
      return false;
  }
}
