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
import { isChildConsentPending } from "@/backend/features/consent/consent.guard";
import { resolveGuardianSharing } from "./parent-sharing.service";
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
 * Media bytes are served only when the child shares photos/drawings AND
 * the guardian's own view toggle is on (same rule as the guardian home).
 */
export async function requireGuardianMediaAccess(
  guardianUserId: string
): Promise<string> {
  const childUserId = await requireLinkedChildForGuardian(guardianUserId);
  if (await isChildConsentPending(childUserId)) {
    throw new DomainError("먼저 보호자 동의를 완료해 주세요.", "FORBIDDEN");
  }
  const sharing = await resolveGuardianSharing(guardianUserId, childUserId);
  if (sharing.media === "child_private") {
    throw new DomainError("아이가 아직 사진·그림을 나누지 않았어요.", "FORBIDDEN");
  }
  if (sharing.media !== "shown") {
    throw new DomainError("그림·사진 보기가 꺼져 있어요.", "FORBIDDEN");
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
