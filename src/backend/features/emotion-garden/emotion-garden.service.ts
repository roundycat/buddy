import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import { appendLedgerEntry, hasLedgerRef } from "@/backend/features/wallet/wallet.store";
import {
  getGardenAccount,
  saveGardenAccount,
} from "./emotion-garden.store";
import type {
  EmotionGardenResponse,
  GardenFlower,
  MoodId,
  MoodOption,
} from "./emotion-garden.types";
import { todayKey } from "@/backend/shared/time/date";
import { recordGardenEmotion } from "@/backend/features/emotion-analysis/emotion.service";

export const MOOD_OPTIONS: MoodOption[] = [
  { id: "happy", emoji: "😊", label: "좋아요" },
  { id: "sad", emoji: "😢", label: "슬퍼요" },
  { id: "sleepy", emoji: "😴", label: "피곤해요" },
  { id: "angry", emoji: "😡", label: "짜증나요" },
  { id: "love", emoji: "😍", label: "따뜻해요" },
];

const FLOWER_BY_MOOD: Record<MoodId, { name: string; note: string }> = {
  happy: {
    name: "햇살 데이지",
    note: "가볍게 웃을 수 있었던 하루에 피어요.",
  },
  sad: {
    name: "이슬 블루벨",
    note: "눈물이 나도 괜찮아요. 이슬을 머금고 자라요.",
  },
  sleepy: {
    name: "달빛 양귀비",
    note: "쉬는 날에도 정원은 조용히 커져요.",
  },
  angry: {
    name: "불꽃 튤립",
    note: "화가 나도 여기는 안전한 자리예요.",
  },
  love: {
    name: "다정 카네이션",
    note: "누군가·무언가가 따뜻했던 하루에 피어요.",
  },
};

async function buildResponse(
  userId: string,
  dayCount: number
): Promise<EmotionGardenResponse> {
  const account = await getGardenAccount(userId);
  const today = todayKey();
  const todayFlower = account.flowers.find((f) => f.plantedOn === today);
  const flowerCount = account.flowers.length;
  const plotSlots = Math.max(6, Math.min(24, dayCount + flowerCount + 2));

  return {
    title: "감정 정원",
    companionNote: account.storybookSealed
      ? "이 정원은 스토리북에 소중히 넣어 두었어요. 언제든 다시 펼쳐 볼 수 있어요."
      : "오늘 기분을 고르면 꽃 하나가 피어요. 감정을 적는 게 아니라, 같이 키워요.",
    dayCount,
    todayDate: today,
    todayMood: todayFlower?.mood ?? null,
    canPlantToday: !account.storybookSealed && !todayFlower,
    moods: MOOD_OPTIONS,
    flowers: [...account.flowers].sort((a, b) =>
      a.plantedOn < b.plantedOn ? 1 : -1
    ),
    plotSlots,
    storybook: {
      sealed: account.storybookSealed,
      title: "나의 입원 정원 스토리북",
      summary: account.storybookSealed
        ? `${flowerCount}송이의 꽃이 입원 ${dayCount}일의 이야기를 담고 있어요.`
        : "퇴원하면 이 정원을 스토리북에 넣어요. 길었던 날들이 한 권의 꽃이 됩니다.",
      flowerCount,
      sealedAt: account.sealedAt,
    },
  };
}

export async function getEmotionGarden(
  userId?: string
): Promise<EmotionGardenResponse> {
  if (!userId) {
    return buildResponse("anonymous", 1);
  }
  const persona = await getPersonaForUser(userId);
  return buildResponse(userId, persona.dayCount ?? 1);
}

export async function plantTodayMood(
  userId: string,
  mood: MoodId
): Promise<EmotionGardenResponse & { bloomed: GardenFlower }> {
  if (!MOOD_OPTIONS.some((m) => m.id === mood)) {
    throw new Error("선택할 수 없는 기분이에요.");
  }

  const account = await getGardenAccount(userId);
  if (account.storybookSealed) {
    throw new Error("스토리북에 넣은 뒤에는 새 꽃을 심을 수 없어요.");
  }

  const today = todayKey();
  const existing = account.flowers.find((f) => f.plantedOn === today);
  if (existing) {
    throw new Error("오늘은 이미 꽃이 피었어요. 내일 또 키워요.");
  }

  const persona = await getPersonaForUser(userId);
  const dayIndex = persona.dayCount ?? 1;
  const meta = FLOWER_BY_MOOD[mood];
  const moodMeta = MOOD_OPTIONS.find((m) => m.id === mood)!;

  const bloomed: GardenFlower = {
    id: `fl-${today}-${mood}`,
    mood,
    emoji: moodMeta.emoji,
    dayIndex,
    plantedOn: today,
    name: meta.name,
    note: meta.note,
  };

  await saveGardenAccount({
    ...account,
    flowers: [...account.flowers, bloomed],
  });

  await recordGardenEmotion({
    userId,
    moodId: mood,
    moodLabel: moodMeta.label,
  }).catch((error) => {
    console.warn("[garden] emotion record skipped", error);
  });

  const rewardRef = `garden-${today}`;
  if (!(await hasLedgerRef(userId, rewardRef))) {
    await appendLedgerEntry(userId, {
      amount: 5,
      reason: `감정 정원 · ${meta.name}`,
      source: "bonus",
      refId: rewardRef,
    });
  }

  const garden = await getEmotionGarden(userId);
  return { ...garden, bloomed };
}

export async function sealGardenStorybook(
  userId: string
): Promise<EmotionGardenResponse> {
  const account = await getGardenAccount(userId);
  if (account.flowers.length === 0) {
    throw new Error("꽃이 하나라도 있어야 스토리북에 넣을 수 있어요.");
  }
  if (account.storybookSealed) {
    return getEmotionGarden(userId);
  }

  await saveGardenAccount({
    ...account,
    storybookSealed: true,
    sealedAt: new Date().toISOString(),
  });

  return getEmotionGarden(userId);
}
