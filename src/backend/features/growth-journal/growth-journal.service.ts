import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import { getGardenAccount } from "@/backend/features/emotion-garden/emotion-garden.store";
import { MOOD_OPTIONS } from "@/backend/features/emotion-garden/emotion-garden.service";
import { aggregateEmotionsByDay } from "@/backend/features/emotion-analysis/emotion.service";
import { getAdventureQuest } from "@/backend/features/adventure-quest/adventure-quest.service";
import { listDayStoriesForUser } from "@/backend/features/adventure-quest/adventure-story.service";
import { getLlmProvider } from "@/backend/shared/llm";
import type {
  GrowthJournalResponse,
  GrowthMoment,
  MoodPoint,
} from "./growth-journal.types";

function levelFromScore(score: number): number {
  if (score >= 80) return 5;
  if (score >= 65) return 4;
  if (score >= 45) return 3;
  if (score >= 30) return 2;
  return 1;
}

function dateShort(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length < 3) return dateKey;
  return `${parts[1]}-${parts[2]}`;
}

/**
 * Growth Journal — derived from garden + emotion analyses + adventure history.
 */
export async function getGrowthJournal(
  userId?: string
): Promise<GrowthJournalResponse> {
  if (!userId) {
    return {
      companionNote:
        "이건 진단이 아니에요. 병원 생활 속에서 마음이 어떻게 움직여 왔는지를, 부드럽게 보여 주는 기록입니다.",
      moodSeries: [],
      moments: [],
    };
  }

  const [persona, garden, emotionDays, adventure, dayStories] =
    await Promise.all([
      getPersonaForUser(userId),
      getGardenAccount(userId),
      aggregateEmotionsByDay(userId, 14),
      getAdventureQuest(userId),
      listDayStoriesForUser(userId),
    ]);

  const flowerByDay = new Map(
    garden.flowers.map((f) => [f.plantedOn, f] as const)
  );

  const moodSeries: MoodPoint[] = [];
  const seen = new Set<string>();

  for (const day of emotionDays) {
    seen.add(day.dateKey);
    moodSeries.push({
      date: dateShort(day.dateKey),
      label: day.primaryEmotion,
      level: levelFromScore(day.averageScore),
    });
  }

  for (const flower of [...garden.flowers].sort((a, b) =>
    a.plantedOn < b.plantedOn ? 1 : -1
  )) {
    if (seen.has(flower.plantedOn)) continue;
    const meta = MOOD_OPTIONS.find((m) => m.id === flower.mood);
    const scoreMap: Record<string, number> = {
      happy: 82,
      love: 88,
      sleepy: 48,
      sad: 28,
      angry: 36,
    };
    moodSeries.push({
      date: dateShort(flower.plantedOn),
      label: meta?.label ?? flower.mood,
      level: levelFromScore(scoreMap[flower.mood] ?? 50),
    });
    seen.add(flower.plantedOn);
  }

  moodSeries.sort((a, b) => (a.date > b.date ? 1 : -1));
  const trimmedSeries = moodSeries.slice(-7);

  const moments: GrowthMoment[] = [];

  for (const story of dayStories.slice(0, 3)) {
    moments.push({
      id: story.dayStory!.memoryEventId,
      kind: "courage",
      title: "모험을 마친 날",
      note: story.dayStory!.narrative.slice(0, 80),
      date: story.date,
    });
  }

  const latestFlower = garden.flowers
    .slice()
    .sort((a, b) => (a.plantedOn < b.plantedOn ? 1 : -1))[0];
  if (latestFlower) {
    const meta = MOOD_OPTIONS.find((m) => m.id === latestFlower.mood);
    moments.push({
      id: latestFlower.id,
      kind: "mood",
      title: "기분 변화",
      note: `${meta?.label ?? "마음"} 꽃이 피었어요. ${latestFlower.note}`,
      date: latestFlower.plantedOn,
    });
  }

  const completed = adventure.quests.filter((q) => q.status === "done");
  if (completed[0]) {
    moments.push({
      id: `joy-${completed[0].id}`,
      kind: "joy",
      title: "즐거웠던 활동",
      note: `${completed[0].emoji} ${completed[0].title}`,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  if ((persona.dayCount ?? 0) >= 3) {
    moments.push({
      id: "adapt-hospital",
      kind: "adaptation",
      title: "병원 적응 과정",
      note: `함께한 지 ${persona.dayCount}일째. 병실의 리듬이 조금씩 익숙해지고 있어요.`,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  const llmMoments = await enrichMomentsWithLlm({
    childName: persona.self?.nickname?.trim() || "너",
    moodSeries: trimmedSeries,
    moments: moments.slice(0, 4),
  });

  return {
    companionNote:
      "이건 진단이 아니에요. 병원 생활 속에서 마음이 어떻게 움직여 왔는지를, 부드럽게 보여 주는 기록입니다.",
    moodSeries: trimmedSeries,
    moments: llmMoments.length > 0 ? llmMoments : moments.slice(0, 4),
  };
}

async function enrichMomentsWithLlm(input: {
  childName: string;
  moodSeries: MoodPoint[];
  moments: GrowthMoment[];
}): Promise<GrowthMoment[]> {
  if (input.moments.length === 0) return [];
  try {
    const llm = getLlmProvider();
    if (llm.name === "mock") return input.moments;

    const result = await llm.chat({
      temperature: 0.5,
      maxTokens: 500,
      messages: [
        {
          role: "system",
          content: `Beddy 성장 기록 에디터입니다. 의료 진단 없이 따뜻한 한국어로 순간 설명을 다듬습니다.
JSON만: { "moments": [{ "id": "...", "note": "한두 문장" }] }`,
        },
        {
          role: "user",
          content: `아이: ${input.childName}
기분 흐름: ${JSON.stringify(input.moodSeries)}
순간들: ${JSON.stringify(input.moments)}`,
        },
      ],
    });

    const match = result.content.match(/\{[\s\S]*\}/);
    if (!match) return input.moments;
    const parsed = JSON.parse(match[0]) as {
      moments?: Array<{ id?: string; note?: string }>;
    };
    if (!parsed.moments?.length) return input.moments;

    return input.moments.map((m) => {
      const hit = parsed.moments?.find((p) => p.id === m.id);
      return hit?.note?.trim() ? { ...m, note: hit.note.trim().slice(0, 120) } : m;
    });
  } catch (error) {
    console.warn("[growth-journal] LLM enrich skipped", error);
    return input.moments;
  }
}
