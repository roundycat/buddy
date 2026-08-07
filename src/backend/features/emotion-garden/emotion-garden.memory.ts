import "server-only";
import { getAdventurePack } from "@/backend/features/adventure-quest/adventure-quest.store";
import { isQuestReadyToClaim } from "@/backend/features/adventure-quest/adventure-quest.rules";
import { listEmotionRecords } from "@/backend/features/emotion-analysis/emotion.store";
import { listPhotosForUser } from "@/backend/features/photo-album/photo-album.store";
import { getGardenAccount } from "./emotion-garden.store";
import { flowerForMood } from "./emotion-garden.flowers";
import {
  stageForPlant,
  STAGE_LABEL,
} from "./emotion-garden.growth";
import type { FlowerMemoryCard } from "./emotion-garden.types";

function isAdventureComplete(
  pack: Awaited<ReturnType<typeof getAdventurePack>>
): boolean {
  if (!pack) return false;
  if (pack.dayStory) return true;
  if (pack.quests.length === 0) return false;
  return pack.quests.every((q) =>
    isQuestReadyToClaim({ kind: q.kind, progress: q.progress })
  );
}

/**
 * Join a flower with that day's adventure, photos, and emotion summaries.
 * Drawing / voice slots are reserved but inactive until those features exist.
 */
export async function getFlowerMemoryCard(
  userId: string,
  flowerId: string
): Promise<FlowerMemoryCard | null> {
  const account = await getGardenAccount(userId);
  const flower = account.flowers.find((f) => f.id === flowerId);
  if (!flower) return null;

  const date = flower.plantedOn;
  const species = flowerForMood(flower.mood);
  const pack = await getAdventurePack(userId, date);
  const adventureDone = isAdventureComplete(pack);
  const stage = stageForPlant(flower, adventureDone);

  const photosMeta = await listPhotosForUser(userId);
  const dayPhotos = photosMeta.filter((p) => p.createdAt.startsWith(date));
  const questPhotoIds = new Set(
    (pack?.quests ?? [])
      .map((q) => q.progress?.photoId)
      .filter((id): id is string => Boolean(id))
  );

  const orderedPhotos = [
    ...dayPhotos.filter((p) => questPhotoIds.has(p.id)),
    ...dayPhotos.filter((p) => !questPhotoIds.has(p.id)),
  ].slice(0, 6);

  const emotionSummaries = (await listEmotionRecords(userId))
    .filter((r) => r.dateKey === date)
    .map((r) => r.summary)
    .filter(Boolean)
    .slice(-5);

  const narrative = pack?.dayStory?.narrative?.trim() || null;
  const reflection =
    narrative ||
    emotionSummaries[emotionSummaries.length - 1] ||
    `${species.emotionLabel}이(가) ${species.flowerName}이(가) 되어 정원에 남았어요.`;

  return {
    flowerId: flower.id,
    plantedOn: date,
    mood: flower.mood,
    flowerName: species.flowerName,
    emotionLabel: species.emotionLabel,
    emoji: species.emoji,
    note: flower.note || species.note,
    stage,
    adventure: {
      headline: pack?.headline ?? null,
      narrative,
      quests: (pack?.quests ?? []).map((q) => ({
        emoji: q.emoji,
        title: q.title,
        done: isQuestReadyToClaim({ kind: q.kind, progress: q.progress }),
      })),
    },
    photos: orderedPhotos.map((p) => ({
      id: p.id,
      url: `/api/photos/${p.id}`,
      caption: p.caption,
    })),
    conversationSummaries: emotionSummaries,
    reflection,
    drawingAvailable: false,
    voiceAvailable: false,
  };
}

export { isAdventureComplete, STAGE_LABEL };
