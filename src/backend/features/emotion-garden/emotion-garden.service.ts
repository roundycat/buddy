import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import { getWeatherForUser } from "@/backend/features/weather/weather.service";
import { getAdventurePack, listAdventurePacksForUser } from "@/backend/features/adventure-quest/adventure-quest.store";
import { DomainError } from "@/backend/shared/http/domain-error";
import {
  getGardenAccount,
  saveGardenAccount,
} from "./emotion-garden.store";
import {
  applyWatering,
  canWaterPlant,
  growthProgress,
  sealBloomIfReady,
  stageForPlant,
  STAGE_LABEL,
  waterCount,
} from "./emotion-garden.growth";
import {
  flowerForMood,
  isMoodId,
  MOOD_OPTIONS,
} from "./emotion-garden.flowers";
import { suggestTodaySeed } from "./emotion-garden.seed";
import { isAdventureComplete } from "./emotion-garden.memory";
import type {
  EmotionGardenResponse,
  GardenFlower,
  GardenPlantView,
  GardenSky,
  MoodId,
  SkyPhase,
} from "./emotion-garden.types";
import { todayKey } from "@/backend/shared/time/date";
import { recordGardenEmotion } from "@/backend/features/emotion-analysis/emotion.service";

export { MOOD_OPTIONS };

/** Hour of day in Asia/Seoul — ECS runs on UTC, children do not. */
function seoulHour(now = Date.now()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hour12: false,
  }).format(new Date(now));
  const parsed = Number(hour);
  return Number.isFinite(parsed) ? parsed % 24 : 12;
}

export function skyPhaseForHour(hour: number): SkyPhase {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

async function adventureDoneForDate(
  userId: string,
  date: string,
  adventureDoneByDate?: Map<string, boolean>
): Promise<boolean> {
  if (userId === "anonymous") return false;
  if (adventureDoneByDate) {
    return adventureDoneByDate.get(date) ?? false;
  }
  const pack = await getAdventurePack(userId, date);
  return isAdventureComplete(pack);
}

async function loadAdventureDoneByDate(
  userId: string
): Promise<Map<string, boolean>> {
  if (userId === "anonymous") return new Map();
  const packs = await listAdventurePacksForUser(userId);
  return new Map(packs.map((p) => [p.date, isAdventureComplete(p)]));
}

async function toPlantView(
  plant: GardenFlower,
  userId: string,
  adventureDoneByDate?: Map<string, boolean>
): Promise<GardenPlantView> {
  const adventureComplete = await adventureDoneForDate(
    userId,
    plant.plantedOn,
    adventureDoneByDate
  );
  const stage = stageForPlant(plant, adventureComplete);
  const species = flowerForMood(plant.mood);
  return {
    ...plant,
    stage,
    progress: growthProgress(plant, adventureComplete),
    stageLabel: STAGE_LABEL[stage],
    canWater: canWaterPlant(plant, adventureComplete),
    waterCount: waterCount(plant),
    adventureComplete,
    flowerName: species.flowerName,
    name: plant.name || species.flowerName,
    note: plant.note || species.note,
    emoji: plant.emoji || species.emoji,
  };
}

async function buildSky(userId: string): Promise<GardenSky> {
  const phase = skyPhaseForHour(seoulHour());
  try {
    const weather = await getWeatherForUser(
      userId === "anonymous" ? undefined : userId
    );
    return {
      phase,
      weather: weather.code,
      weatherLabel: weather.label,
      weatherEmoji: weather.emoji,
      tempC: weather.tempC ?? null,
    };
  } catch (error) {
    console.warn("[garden] sky weather skipped", error);
    return {
      phase,
      weather: "cloudy",
      weatherLabel: "흐림",
      weatherEmoji: "☁️",
      tempC: null,
    };
  }
}

function companionNoteFor(
  sealed: boolean,
  plants: GardenPlantView[],
  canPlantToday: boolean,
  suggestionLabel: string | null
): string {
  if (sealed) {
    return "이 정원은 스토리북에 소중히 넣어 두었어요. 언제든 다시 펼쳐 볼 수 있어요.";
  }
  const needWater = plants.filter((p) => p.canWater);
  if (needWater.length > 0) {
    return "물을 주듯 마음을 전해주면 씨앗이 조금 더 자라요. 모든 감정은 돌봄받을 가치가 있어요.";
  }
  if (canPlantToday && suggestionLabel) {
    return `오늘의 감정 씨앗이 준비됐어요. ${suggestionLabel} 씨앗을 심어 볼까요?`;
  }
  if (canPlantToday) {
    return "오늘의 감정 씨앗을 심어 볼까요? 어떤 기분이든 아름다운 꽃이 돼요.";
  }
  const blooming = plants.filter((p) => p.stage === "bloom");
  if (blooming.length > 0 && plants.every((p) => p.stage === "bloom")) {
    return "정원이 조용히 피어 있어요. 꽃을 누르면 그날의 기억이 열려요.";
  }
  return "오늘의 모험을 마치면 꽃봉오리가 더 활짝 펴요.";
}

/**
 * Persist bloom stamps when adventure completion (or solo waters) unlocked them.
 */
async function syncBlooms(
  userId: string,
  account: Awaited<ReturnType<typeof getGardenAccount>>,
  adventureDoneByDate: Map<string, boolean>
) {
  const nowIso = new Date().toISOString();
  let changed = false;
  const flowers = account.flowers.map((f) => {
    const done = adventureDoneByDate.get(f.plantedOn) ?? false;
    const next = sealBloomIfReady(f, done, nowIso);
    if (next !== f && next.bloomedAt !== f.bloomedAt) changed = true;
    return next;
  });
  if (!changed) return account;
  return saveGardenAccount({ ...account, flowers });
}

async function buildResponse(
  userId: string,
  dayCount: number
): Promise<EmotionGardenResponse> {
  let account = await getGardenAccount(userId);
  const adventureDoneByDate = await loadAdventureDoneByDate(userId);
  account = await syncBlooms(userId, account, adventureDoneByDate);

  const today = todayKey();
  const todaySeed = account.flowers.find((f) => f.plantedOn === today);
  const flowerCount = account.flowers.length;
  const plotSlots = Math.max(6, Math.min(24, dayCount + flowerCount + 2));

  const plants = await Promise.all(
    [...account.flowers]
      .sort((a, b) => (a.plantedOn < b.plantedOn ? 1 : -1))
      .map((f) => toPlantView(f, userId, adventureDoneByDate))
  );

  const canPlantToday = !account.storybookSealed && !todaySeed;
  const suggestion =
    canPlantToday && userId !== "anonymous"
      ? await suggestTodaySeed(userId, today)
      : null;

  return {
    title: "감정 정원",
    companionNote: companionNoteFor(
      account.storybookSealed,
      plants,
      canPlantToday,
      suggestion ? flowerForMood(suggestion.mood).emotionLabel : null
    ),
    dayCount,
    todayDate: today,
    todayMood: todaySeed?.mood ?? null,
    canPlantToday,
    moods: MOOD_OPTIONS,
    flowers: plants,
    plotSlots,
    sky: await buildSky(userId),
    bloomedCount: plants.filter((p) => p.stage === "bloom").length,
    suggestion,
    storybook: {
      sealed: account.storybookSealed,
      title: "나의 입원 정원 스토리북",
      summary: account.storybookSealed
        ? `${flowerCount}송이의 꽃이 입원 ${dayCount}일의 이야기를 담고 있어요.`
        : "꽃이 하나씩 피면 스토리북에 한 페이지가 생겨요. 퇴원하면 한 권의 기억이 됩니다.",
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

/**
 * Plant today's emotional seed. One per day. No star-piece reward.
 */
export async function plantTodaySeed(
  userId: string,
  mood: MoodId
): Promise<EmotionGardenResponse & { planted: GardenPlantView }> {
  if (!isMoodId(mood)) {
    throw new DomainError("선택할 수 없는 감정이에요.");
  }

  const account = await getGardenAccount(userId);
  if (account.storybookSealed) {
    throw new DomainError(
      "스토리북에 넣은 뒤에는 새 씨앗을 심을 수 없어요.",
      "FORBIDDEN"
    );
  }

  const today = todayKey();
  if (account.flowers.some((f) => f.plantedOn === today)) {
    throw new DomainError(
      "오늘의 씨앗은 이미 심었어요. 내일 또 심어요.",
      "CONFLICT"
    );
  }

  const persona = await getPersonaForUser(userId);
  const dayIndex = persona.dayCount ?? 1;
  const species = flowerForMood(mood);
  const nowIso = new Date().toISOString();

  const planted: GardenFlower = {
    id: `fl-${today}-${mood}`,
    mood,
    emoji: species.emoji,
    dayIndex,
    plantedOn: today,
    name: species.flowerName,
    note: species.note,
    plantedAt: nowIso,
    waterings: [],
  };

  await saveGardenAccount({
    ...account,
    flowers: [...account.flowers, planted],
  });

  await recordGardenEmotion({
    userId,
    moodId: mood,
    moodLabel: species.emotionLabel,
  }).catch((error) => {
    console.warn("[garden] emotion record skipped", error);
  });

  const garden = await getEmotionGarden(userId);
  const view = garden.flowers.find((f) => f.id === planted.id)!;
  return { ...garden, planted: view };
}

/**
 * Water a plant once. Advances seed → sprout → bud (and bloom after 3 waters).
 */
export async function waterPlant(
  userId: string,
  plantId: string
): Promise<EmotionGardenResponse & { watered: GardenPlantView }> {
  const account = await getGardenAccount(userId);
  if (account.storybookSealed) {
    throw new DomainError(
      "스토리북에 넣은 정원은 더 돌볼 수 없어요.",
      "FORBIDDEN"
    );
  }

  const target = account.flowers.find((f) => f.id === plantId);
  if (!target) {
    throw new DomainError("그 자리에는 심어진 것이 없어요.", "NOT_FOUND");
  }

  const adventureComplete = await adventureDoneForDate(
    userId,
    target.plantedOn
  );
  if (!canWaterPlant(target, adventureComplete)) {
    throw new DomainError("이미 활짝 핀 꽃이에요.", "CONFLICT");
  }

  const nowIso = new Date().toISOString();
  let next = applyWatering(target, nowIso);
  next = sealBloomIfReady(
    next,
    await adventureDoneForDate(userId, next.plantedOn),
    nowIso
  );

  await saveGardenAccount({
    ...account,
    flowers: account.flowers.map((f) => (f.id === plantId ? next : f)),
  });

  const species = flowerForMood(next.mood);
  await recordGardenEmotion({
    userId,
    moodId: next.mood,
    moodLabel: species.emotionLabel,
  }).catch((error) => {
    console.warn("[garden] emotion record skipped", error);
  });

  const garden = await getEmotionGarden(userId);
  const view = garden.flowers.find((f) => f.id === plantId)!;
  return { ...garden, watered: view };
}

/** @deprecated Prefer waterPlant — kept for any stale client calling /care */
export async function careForPlant(
  userId: string,
  plantId: string,
  _mood?: MoodId
): Promise<EmotionGardenResponse & { cared: GardenPlantView }> {
  const result = await waterPlant(userId, plantId);
  return { ...result, cared: result.watered };
}

export async function sealGardenStorybook(
  userId: string
): Promise<EmotionGardenResponse> {
  const account = await getGardenAccount(userId);
  if (account.flowers.length === 0) {
    throw new DomainError("꽃이 하나라도 있어야 스토리북에 넣을 수 있어요.");
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
