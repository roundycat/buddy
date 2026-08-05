import { runLlm } from "@/backend/ai/orchestrator";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { env } from "@/backend/shared/config/env";
import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import { getHospitalDay } from "@/backend/features/hospital-day/hospital-day.service";
import { getGardenAccount } from "@/backend/features/emotion-garden/emotion-garden.store";
import { MOOD_OPTIONS } from "@/backend/features/emotion-garden/emotion-garden.service";
import { hasLedgerRef } from "@/backend/features/wallet/wallet.store";
import { getConversationMemory } from "@/backend/features/conversation/conversation.store";
import { countGuardiansForChild } from "@/backend/features/guardian-link/guardian-link.store";
import { latestEmotionSummary } from "@/backend/features/emotion-analysis/emotion.service";
import { getWeatherForUser } from "@/backend/features/weather/weather.service";
import {
  getAdventurePack,
  saveAdventurePack,
} from "./adventure-quest.store";
import {
  actionHrefFor,
  buildFactorChips,
  buildRuleBasedPack,
  isQuestReadyToClaim,
  normalizeQuestKind,
  resolveScene,
} from "./adventure-quest.rules";
import type {
  AdventureContextFactors,
  AdventureDayPack,
  AdventureDayPackQuest,
  AdventureQuestProgress,
  AdventureQuestResponse,
} from "./adventure-quest.types";
import { todayKey } from "@/backend/shared/time/date";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";

function headlineForLiveWeather(
  weather: AdventureContextFactors["weather"]
): string {
  if (weather.code === "sunny") {
    return "☀️ 맑은 하늘 아래, 병실 속 작은 빛을 찾아보는 날 ✨";
  }
  if (weather.code === "rainy") {
    return "🌧️ 비 오는 날, 병실 안에서도 할 수 있는 작은 모험 💧";
  }
  return `${weather.emoji} ${weather.label}한 하늘 아래, 병실 속 작은 모험 ✨`;
}

function shouldRefreshWeatherHeadline(
  headline: string,
  weather: AdventureContextFactors["weather"]
): boolean {
  const h = headline;
  const mentionsRain = /비|빗|소나기|🌧️/.test(h);
  const mentionsSun = /맑|쨍|햇|☀️|🌤️/.test(h);
  const mentionsCloud = /흐린|흐림|구름|☁️|⛅/.test(h);
  if (weather.code === "sunny") return mentionsRain || mentionsCloud;
  if (weather.code === "rainy") return mentionsSun || (mentionsCloud && !mentionsRain);
  return mentionsSun || mentionsRain;
}

function ageFromBirthYear(birth?: string): number | null {
  if (!birth) return null;
  const year = Number(birth);
  if (!Number.isFinite(year) || year < 1990 || year > 2020) return null;
  return new Date().getFullYear() - year;
}

function parseInterests(...chunks: Array<string | undefined>): string[] {
  const raw = chunks.filter(Boolean).join(", ");
  if (!raw.trim()) return [];
  return raw
    .split(/[,/·|/]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .slice(0, 5);
}

async function fetchAdventureWeather(
  userId: string,
  date: string
): Promise<AdventureContextFactors["weather"]> {
  const snap = await getWeatherForUser(userId, date);
  return {
    code: snap.code,
    label: snap.label,
    emoji: snap.emoji,
  };
}

async function buildContext(
  userId: string,
  date = todayKey()
): Promise<AdventureContextFactors> {
  const [persona, hospital, garden, memory, guardianCount, latestEmotion, weather] =
    await Promise.all([
      getPersonaForUser(userId),
      getHospitalDay(userId),
      getGardenAccount(userId),
      getConversationMemory(userId),
      countGuardiansForChild(userId),
      latestEmotionSummary(userId),
      fetchAdventureWeather(userId, date),
    ]);

  const self = persona.self;
  const todayFlower = garden.flowers.find((f) => f.plantedOn === date);
  const moodMeta = todayFlower
    ? MOOD_OPTIONS.find((m) => m.id === todayFlower.mood)
    : null;

  const treatmentItems = hospital.items.filter(
    (item) =>
      (item.type === "exam" || item.type === "treatment") && !item.done
  );

  const outdoorOk = weather.code === "sunny";
  const emotionalThemes = [
    ...(latestEmotion ? [latestEmotion.primaryEmotion] : []),
    ...memory.emotionalThemes,
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  return {
    weather,
    ward: {
      outdoorOk,
      label: outdoorOk ? "실내·정원 가능" : "실내 위주",
    },
    mood: moodMeta
      ? { id: moodMeta.id, label: moodMeta.label, emoji: moodMeta.emoji }
      : latestEmotion
        ? {
            id: null,
            label: latestEmotion.primaryEmotion,
            emoji: "💭",
          }
        : { id: null, label: "아직 없음", emoji: "🌱" },
    age: ageFromBirthYear(self?.ageOrBirthYear),
    interests: parseInterests(
      self?.hobbies,
      self?.favoriteHobby,
      persona.profile?.hobbies
    ),
    schedule: {
      hasTreatment: treatmentItems.length > 0,
      labels: treatmentItems.map((item) => item.title).slice(0, 3),
    },
    energy: persona.energy ?? null,
    memory: {
      turnCount: memory.turnCount,
      emotionalThemes: emotionalThemes.slice(0, 3),
      toneHint:
        memory.preferredToneNotes[0] ?? latestEmotion?.summary ?? null,
    },
    guardian: {
      linked: guardianCount > 0,
      count: guardianCount,
    },
  };
}

function normalizePackQuest(
  quest: AdventureDayPackQuest & { kind?: string },
  date: string,
  index: number
): AdventureDayPackQuest {
  const title = quest.title?.trim() || "작은 모험";
  const hint = quest.hint?.trim() || "천천히, 할 수 있는 만큼만요.";
  const kind = normalizeQuestKind(quest.kind, title, hint);
  return {
    id: quest.id || `aq-${date}-${index}`,
    emoji: (quest.emoji ?? "🌈").trim().slice(0, 4) || "🌈",
    title,
    hint,
    points: Math.min(
      20,
      Math.max(10, Number.isFinite(quest.points) ? Number(quest.points) : 12)
    ),
    kind,
    progress: quest.progress ?? {},
  };
}

async function tryGenerateWithLlm(
  userId: string,
  date: string,
  context: AdventureContextFactors,
  scene: ReturnType<typeof resolveScene>
): Promise<AdventureDayPack | null> {
  if (env.llmProvider === "mock") return null;
  const system = `당신은 입원 청소년을 위한 앱 Beddy의 오늘의 모험 Agent입니다.
병실·복도·침대 근처에서 할 수 있는 작고 즐거운 모험을 제안하세요.
각 모험은 앱 안에서 할 수 있어야 합니다. kind는 photo|garden|chat|post|observe 중 하나.
위험하거나 무리한 활동만 피하세요. 한국어. JSON만 출력.`;

  const user = `오늘 날짜: ${date}
장면 유형: ${scene}
컨텍스트:
${JSON.stringify(context, null, 2)}

정확히 3개의 모험을 만들어 주세요. 형식:
{
  "headline": "이모지와 함께 오늘의 한 줄",
  "companionNote": "왜 이런 모험인지 한두 문장",
  "quests": [
    {
      "emoji": "🌳",
      "title": "짧은 제목",
      "hint": "어떻게 하면 되는지",
      "points": 10,
      "kind": "photo"
    }
  ]
}
kind 설명:
- photo: 사진 업로드
- garden: 감정 정원
- chat: 대기실에서 베디와 대화
- post: 우체국 편지
- observe: 짧은 메모 또는 선택 사진
points는 10~20 정수. 가능하면 kind를 다양하게.`;

  try {
    const result = await runLlm({
      feature: "adventure.quest",
      purpose: "quality",
      messages: [
        { role: "system", content: withBeddySafety(system) },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      maxTokens: 900,
    });

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
            id: `aq-${date}-${index}`,
            emoji: q.emoji ?? "🌈",
            title: q.title!,
            hint: q.hint ?? "",
            points: q.points ?? 12,
            kind: normalizeQuestKind(q.kind, q.title, q.hint),
            progress: {},
          },
          date,
          index
        )
      );

    if (quests.length < 3) return null;

    return {
      userId,
      date,
      scene,
      headline: parsed.headline?.trim() || "🌈 오늘의 작은 모험",
      companionNote:
        parsed.companionNote?.trim() ||
        "오늘 상태와 병원에 맞춰 작은 모험을 골랐어요.",
      factors: buildFactorChips(context, scene),
      context,
      quests,
      generatedBy: "llm",
    };
  } catch (error) {
    console.warn("[adventure] LLM generate failed → rules", error);
    return null;
  }
}

function migratePack(pack: AdventureDayPack): AdventureDayPack {
  const quests = pack.quests.map((q, index) =>
    normalizePackQuest(q as AdventureDayPackQuest & { kind?: string }, pack.date, index)
  );
  return { ...pack, quests };
}

async function ensureTodayPack(userId: string): Promise<AdventureDayPack> {
  const date = todayKey();
  const liveWeather = await fetchAdventureWeather(userId, date);
  const existing = await getAdventurePack(userId, date);
  if (existing) {
    const migrated = migratePack(existing);
    const weatherChanged =
      migrated.context?.weather?.code !== liveWeather.code ||
      migrated.context?.weather?.label !== liveWeather.label;
    const outdoorOk = liveWeather.code === "sunny";
    let next: AdventureDayPack = {
      ...migrated,
      context: {
        ...migrated.context,
        weather: liveWeather,
        ward: {
          outdoorOk,
          label: outdoorOk ? "실내·정원 가능" : "실내 위주",
        },
      },
    };
    next = {
      ...next,
      factors: buildFactorChips(next.context, next.scene),
      headline:
        weatherChanged ||
        shouldRefreshWeatherHeadline(next.headline, liveWeather)
          ? headlineForLiveWeather(liveWeather)
          : next.headline,
    };
    const needsSave =
      weatherChanged ||
      existing.quests.some((q) => !(q as AdventureDayPackQuest).kind) ||
      next.headline !== existing.headline;
    if (needsSave) return saveAdventurePack(next);
    return next;
  }

  return prepareAdventurePackForDate(userId, date);
}

/**
 * Pre-create (or rebuild) the day's adventure pack — used by dawn batch + first open.
 */
export async function prepareAdventurePackForDate(
  userId: string,
  date: string
): Promise<AdventureDayPack> {
  const context = await buildContext(userId, date);
  const scene = resolveScene(context);
  const llmPack = await tryGenerateWithLlm(userId, date, context, scene);
  const pack = llmPack ?? buildRuleBasedPack(userId, date, scene, context);
  return saveAdventurePack(pack);
}

/**
 * Today's Small Adventure Service
 */
export async function getAdventureQuest(
  userId?: string
): Promise<AdventureQuestResponse> {
  const uid = userId ?? "anonymous";
  const pack = await ensureTodayPack(uid);

  const quests = await Promise.all(
    pack.quests.map(async (quest) => {
      const done =
        Boolean(userId) && (await hasLedgerRef(userId!, quest.id));
      const progress = quest.progress ?? {};
      const readyToClaim =
        !done && isQuestReadyToClaim({ kind: quest.kind, progress });
      return {
        id: quest.id,
        emoji: quest.emoji,
        title: quest.title,
        hint: quest.hint,
        points: quest.points,
        kind: quest.kind,
        actionHref: actionHrefFor(quest.kind, quest.id),
        status: done ? ("done" as const) : ("available" as const),
        progress,
        readyToClaim,
      };
    })
  );
  const completedCount = quests.filter((q) => q.status === "done").length;

  return {
    scene: pack.scene,
    headline: pack.headline,
    dateLabel: "오늘의 작은 모험",
    companionNote: pack.companionNote,
    factors: pack.factors,
    context: pack.context,
    quests,
    dayStory: pack.dayStory ?? null,
    completedCount,
    allComplete: completedCount === quests.length && quests.length > 0,
  };
}

export async function updateAdventureProgress(
  userId: string,
  questId: string,
  patch: AdventureQuestProgress
): Promise<AdventureQuestResponse> {
  const date = todayKey();
  const pack = await ensureTodayPack(userId);
  const index = pack.quests.findIndex((q) => q.id === questId);
  if (index < 0) {
    throw new Error("오늘의 모험에서만 진행할 수 있어요.");
  }

  const quest = pack.quests[index]!;
  const nextProgress: AdventureQuestProgress = {
    ...quest.progress,
    ...patch,
  };
  if (patch.note !== undefined) {
    nextProgress.note = patch.note.trim().slice(0, 200);
  }
  if (
    quest.kind === "garden" ||
    quest.kind === "chat" ||
    quest.kind === "post"
  ) {
    nextProgress.completedAt =
      nextProgress.completedAt ?? new Date().toISOString();
  }
  if (quest.kind === "observe" && (nextProgress.note || nextProgress.photoId)) {
    nextProgress.completedAt =
      nextProgress.completedAt ?? new Date().toISOString();
  }
  if (quest.kind === "photo" && nextProgress.photoId) {
    nextProgress.completedAt =
      nextProgress.completedAt ?? new Date().toISOString();
  }

  const quests = [...pack.quests];
  quests[index] = { ...quest, progress: nextProgress };
  await saveAdventurePack({ ...pack, quests });
  return getAdventureQuest(userId);
}

export async function attachPhotoToQuest(
  userId: string,
  questId: string,
  photoId: string
): Promise<AdventureQuestResponse> {
  return updateAdventureProgress(userId, questId, { photoId });
}
