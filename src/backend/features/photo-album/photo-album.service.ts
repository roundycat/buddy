import { randomUUID } from "crypto";
import {
  listPhotosForUser,
  readPhotoBytes,
  savePhotoBytes,
  savePhotoMeta,
} from "./photo-album.store";
import type { PhotoAlbumListItem } from "./photo-album.types";
import { attachPhotoToQuest } from "@/backend/features/adventure-quest/adventure-quest.service";

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 6 * 1024 * 1024;

export async function listAlbum(userId: string): Promise<PhotoAlbumListItem[]> {
  const items = await listPhotosForUser(userId);
  return items.map((p) => ({
    id: p.id,
    url: `/api/photos/${p.id}`,
    createdAt: p.createdAt,
    questId: p.questId,
    caption: p.caption,
  }));
}

export async function uploadAlbumPhoto(input: {
  userId: string;
  bytes: Buffer;
  contentType: string;
  questId?: string;
  caption?: string;
}): Promise<PhotoAlbumListItem> {
  const contentType = input.contentType.toLowerCase().split(";")[0]!.trim();
  if (!ALLOWED.has(contentType)) {
    throw new Error("사진(JPEG/PNG/WebP)만 올릴 수 있어요.");
  }
  if (input.bytes.length === 0 || input.bytes.length > MAX_BYTES) {
    throw new Error("사진 크기는 6MB 이하로 올려 주세요.");
  }

  const id = randomUUID();
  await savePhotoBytes(input.userId, id, input.bytes, contentType);
  const createdAt = new Date().toISOString();
  await savePhotoMeta({
    id,
    userId: input.userId,
    contentType,
    createdAt,
    questId: input.questId,
    caption: input.caption?.trim().slice(0, 120) || undefined,
  });

  if (input.questId) {
    await attachPhotoToQuest(input.userId, input.questId, id);
  }

  return {
    id,
    url: `/api/photos/${id}`,
    createdAt,
    questId: input.questId,
    caption: input.caption,
  };
}

export async function getAlbumPhotoBytes(userId: string, photoId: string) {
  return readPhotoBytes(userId, photoId);
}
