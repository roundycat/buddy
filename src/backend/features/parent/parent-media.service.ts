import "server-only";
import { DomainError } from "@/backend/shared/http/domain-error";
import { resolveLinkedChildUserId } from "@/backend/features/guardian-link/guardian-link.service";
import {
  listPhotosForUser,
  readPhotoBytes,
} from "@/backend/features/photo-album/photo-album.store";
import {
  listDiaryEntriesForUser,
  readDiaryImage,
} from "@/backend/features/picture-diary/picture-diary.store";
import type { DiaryImageKind } from "@/backend/features/picture-diary/picture-diary.types";
import type { ParentMediaItem } from "./parent.types";

export async function requireLinkedChildForGuardian(
  guardianUserId: string
): Promise<string> {
  const childUserId = await resolveLinkedChildUserId(guardianUserId);
  if (!childUserId) {
    throw new DomainError("먼저 아이와 연결해 주세요.", "FORBIDDEN");
  }
  return childUserId;
}

/**
 * Privacy-safe gallery of the child's album photos and diary drawings.
 * Image bytes are served only through `/api/parent/media/*` proxies.
 */
export async function listParentChildMedia(
  childUserId: string,
  limit = 24
): Promise<ParentMediaItem[]> {
  const [photos, diaries] = await Promise.all([
    listPhotosForUser(childUserId),
    listDiaryEntriesForUser(childUserId),
  ]);

  const items: ParentMediaItem[] = [];

  for (const photo of photos) {
    items.push({
      id: `photo-${photo.id}`,
      kind: "photo",
      title: "사진첩",
      caption: photo.caption?.trim() || "아이가 남긴 사진",
      imageUrl: `/api/parent/media/photos/${photo.id}`,
      createdAt: photo.createdAt,
      dateKey: photo.createdAt.slice(0, 10),
    });
  }

  for (const entry of diaries) {
    if (entry.hasDrawing) {
      items.push({
        id: `diary-drawing-${entry.id}`,
        kind: "drawing",
        title: "그림 일기",
        caption: "아이가 그린 그림",
        imageUrl: `/api/parent/media/diary/${entry.id}?kind=drawing`,
        createdAt: entry.createdAt,
        dateKey: entry.dateKey,
      });
    }
    if (entry.hasPhoto) {
      items.push({
        id: `diary-photo-${entry.id}`,
        kind: "diary_photo",
        title: "그림 일기",
        caption: "일기에 올린 사진",
        imageUrl: `/api/parent/media/diary/${entry.id}?kind=photo`,
        createdAt: entry.createdAt,
        dateKey: entry.dateKey,
      });
    }
  }

  return items
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

export async function readParentChildPhotoBytes(
  childUserId: string,
  photoId: string
) {
  return readPhotoBytes(childUserId, photoId);
}

export async function readParentChildDiaryImage(
  childUserId: string,
  entryId: string,
  kind: DiaryImageKind
) {
  return readDiaryImage(childUserId, entryId, kind);
}
