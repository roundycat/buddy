import "server-only";
import { getAdventurePack } from "@/backend/features/adventure-quest/adventure-quest.store";
import { isQuestReadyToClaim } from "@/backend/features/adventure-quest/adventure-quest.rules";
import { listEmotionRecords } from "@/backend/features/emotion-analysis/emotion.store";
import { listPhotosForUser } from "@/backend/features/photo-album/photo-album.store";
import { getWishTreeAccount } from "./wish-tree.store";
import { guessWishKind, isWishKind, leafForKind } from "./wish-tree.leaves";
import type { LeafMemoryCard } from "./wish-tree.types";

/**
 * Tap a leaf → the day it was hung.
 * Joins the wish with that day's adventure, photos and conversation.
 * Drawing / voice slots are reserved until those features exist.
 */
export async function getLeafMemoryCard(
  userId: string,
  leafId: string
): Promise<LeafMemoryCard | null> {
  const account = await getWishTreeAccount(userId);
  const wish = account.wishes.find((w) => w.id === leafId);
  if (!wish) return null;

  const date = wish.createdAt.slice(0, 10);
  const kind = isWishKind(wish.kind) ? wish.kind : guessWishKind(wish.text);
  const species = leafForKind(kind);

  const [pack, photosMeta, emotionRecords] = await Promise.all([
    getAdventurePack(userId, date).catch(() => null),
    listPhotosForUser(userId).catch(() => []),
    listEmotionRecords(userId).catch(() => []),
  ]);

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

  const conversationSummaries = emotionRecords
    .filter((r) => r.dateKey === date)
    .map((r) => r.summary)
    .filter(Boolean)
    .slice(-5);

  const narrative = pack?.dayStory?.narrative?.trim() || null;
  const reflection =
    narrative ||
    conversationSummaries[conversationSummaries.length - 1] ||
    `${species.label} 하는 마음이 잎이 되어 나무에 남았어요.`;

  const glowScore =
    (orderedPhotos.length > 0 ? 1 : 0) +
    (narrative ? 1 : 0) +
    (conversationSummaries.length >= 2 ? 1 : 0);

  return {
    leafId: wish.id,
    text: wish.text,
    kind,
    shape: species.shape,
    label: species.label,
    emoji: species.emoji,
    horizon: wish.horizon,
    dateKey: date,
    glow: Math.min(2, glowScore) as 0 | 1 | 2,
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
    conversationSummaries,
    reflection,
    drawingAvailable: false,
    voiceAvailable: false,
  };
}
