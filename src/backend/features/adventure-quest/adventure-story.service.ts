import { getLlmProvider } from "@/backend/shared/llm";
import { appendMemoryEvent } from "@/backend/features/memory-timeline/memory-timeline.store";
import { hasLedgerRef } from "@/backend/features/wallet/wallet.store";
import {
  getAdventurePack,
  saveAdventurePack,
  listAdventurePacksForUser,
} from "./adventure-quest.store";
import type {
  AdventureDayPack,
  AdventureDayStory,
} from "./adventure-quest.types";
import { todayKey } from "@/backend/shared/time/date";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";

function ruleBasedNarrative(pack: AdventureDayPack): string {
  const titles = pack.quests
    .map((q) => `${q.emoji} ${q.title}`)
    .join(", ");
  const weatherLine =
    pack.scene === "sunny"
      ? "오늘은 햇살이 좋은 날이었어."
      : pack.scene === "rainy"
        ? "오늘은 비가 오는 날이었어."
        : pack.scene === "treatment"
          ? "오늘은 검사가 있는 날이었지만,"
          : "오늘은 조금 쉬어가는 날이었지만,";

  const missionBit = pack.quests
    .map((q) => q.title.replace(/하기$/, ""))
    .slice(0, 3);

  let middle = "";
  if (missionBit.length >= 3) {
    middle = `베디와 함께 ${missionBit[0]}을 하고, ${missionBit[1]}도 해 봤고, ${missionBit[2]}까지 해냈어.`;
  } else {
    middle = `베디와 함께 작은 모험(${titles})을 했어.`;
  }

  return `${weatherLine} ${middle} 오늘의 작은 모험도 성공!`;
}

async function generateNarrative(pack: AdventureDayPack): Promise<string> {
  const provider = getLlmProvider();
  if (provider.name === "mock") {
    return ruleBasedNarrative(pack);
  }

  try {
    const result = await provider.chat({
      messages: [
        {
          role: "system",
          content: `당신은 Beddy(베디)입니다. 입원 청소년의 하루 미션을 따뜻한 한국어 이야기로 남깁니다.
확진·처방은 하지 말고, 친구처럼 자랑하듯 다정하게. 길이는 자유롭게. JSON만: { "narrative": "..." }`,
        },
        {
          role: "user",
          content: `헤드라인: ${pack.headline}
장면: ${pack.scene}
날씨: ${pack.context.weather.label}
기분: ${pack.context.mood.label}
완료한 미션:
${pack.quests.map((q) => `- ${q.emoji} ${q.title}`).join("\n")}

예시 톤: "오늘은 햇살이 좋은 날이었어. 베디와 함께 정원을 걸으며 노란 꽃을 발견했고, 용기 내어 좋아하는 노래도 불렀지. 오늘의 작은 모험도 성공!"`,
        },
      ],
      temperature: 0.8,
      maxTokens: 400,
    });

    const parsed = extractJsonObject(result.content) as { narrative?: string };
    const narrative = parsed.narrative?.trim();
    if (narrative && narrative.length > 10) return narrative;
  } catch (error) {
    console.warn("[adventure-story] LLM failed → rules", error);
  }

  return ruleBasedNarrative(pack);
}

/**
 * When all of today's missions are done, compose a day story → Memory Timeline.
 */
export async function maybeComposeDayStory(
  userId: string
): Promise<AdventureDayStory | null> {
  const date = todayKey();
  const pack = await getAdventurePack(userId, date);
  if (!pack) return null;
  if (pack.dayStory) return pack.dayStory;

  const claimFlags = await Promise.all(
    pack.quests.map((q) => hasLedgerRef(userId, q.id))
  );
  const allDone = claimFlags.every(Boolean);
  if (!allDone) return null;

  const narrative = await generateNarrative(pack);
  const memoryEventId = `adv-${userId}-${date}`;
  const createdAt = new Date().toISOString();

  await appendMemoryEvent(userId, {
    id: memoryEventId,
    type: "adventure",
    title: `오늘의 작은 모험 · ${date.slice(5).replace("-", "/")}`,
    summary: narrative,
    occurredAt: createdAt,
    adventureDate: date,
  });

  const dayStory: AdventureDayStory = {
    narrative,
    createdAt,
    memoryEventId,
  };

  await saveAdventurePack({ ...pack, dayStory });
  return dayStory;
}

export async function listDayStoriesForUser(
  userId: string
): Promise<AdventureDayPack[]> {
  const packs = await listAdventurePacksForUser(userId);
  return packs
    .filter((p) => p.dayStory)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
