import { randomUUID } from "crypto";
import {
  assertAllowedImageType,
  assertImageSize,
  normalizeImageContentType,
} from "@/backend/shared/media/image-upload";
import {
  listPhotosForUser,
  readPhotoBytes,
  savePhotoBytes,
  savePhotoMeta,
} from "./photo-album.store";
import type { PhotoAlbumListItem } from "./photo-album.types";
import { attachPhotoToQuest } from "@/backend/features/adventure-quest/adventure-quest.service";

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
  const contentType = normalizeImageContentType(input.contentType);
  assertAllowedImageType(contentType);
  assertImageSize(input.bytes, MAX_BYTES);

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
