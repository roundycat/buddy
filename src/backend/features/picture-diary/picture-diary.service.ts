import "server-only";
import { randomUUID } from "crypto";
import {
  assertAllowedImageType,
  assertImageSize,
  decodeBase64Image,
  normalizeImageContentType,
} from "@/backend/shared/media/image-upload";
import { DomainError } from "@/backend/shared/http/domain-error";
import { todayKey } from "@/backend/shared/time/date";
import {
  listDiaryEntriesForUser,
  saveDiaryEntry,
  saveDiaryImage,
} from "./picture-diary.store";
import type {
  DiaryEntry,
  DiaryEntryView,
  PictureDiaryResponse,
} from "./picture-diary.types";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TEXT = 600;

function toView(entry: DiaryEntry): DiaryEntryView {
  return {
    id: entry.id,
    dateKey: entry.dateKey,
    createdAt: entry.createdAt,
    text: entry.text,
    drawingUrl: entry.hasDrawing
      ? `/api/diary/${entry.id}/image?kind=drawing`
      : undefined,
    photoUrl: entry.hasPhoto
      ? `/api/diary/${entry.id}/image?kind=photo`
      : undefined,
  };
}

export async function getPictureDiary(
  userId?: string
): Promise<PictureDiaryResponse> {
  const entries = userId ? await listDiaryEntriesForUser(userId) : [];
  const today = todayKey();
  const savedToday = entries.some((entry) => entry.dateKey === today);

  return {
    title: "그림일기",
    companionNote: savedToday
      ? "오늘 일기를 남겼구나. 한 장 더 그려도 괜찮아."
      : "오늘 마음을 그림으로 남겨 볼까? 잘 그리지 않아도 괜찮아.",
    entries: entries.map(toView),
    savedToday,
  };
}

export async function createDiaryEntry(input: {
  userId: string;
  text?: string;
  drawingBase64?: string;
  photoBase64?: string;
  photoContentType?: string;
}): Promise<DiaryEntryView> {
  const text = input.text?.trim().slice(0, MAX_TEXT) || undefined;

  const drawing = input.drawingBase64
    ? decodeBase64Image(input.drawingBase64)
    : null;
  const photo = input.photoBase64 ? decodeBase64Image(input.photoBase64) : null;

  if (!text && !drawing && !photo) {
    throw new DomainError("그림이나 사진, 글 중 하나는 남겨 주세요.");
  }

  if (drawing) {
    assertImageSize(
      drawing,
      MAX_BYTES,
      "그림을 저장하지 못했어요. 조금만 단순하게 그려 볼까요?"
    );
  }

  const photoContentType = normalizeImageContentType(input.photoContentType);

  if (photo) {
    assertAllowedImageType(photoContentType);
    assertImageSize(photo, MAX_BYTES);
  }

  const id = randomUUID();
  if (drawing) {
    await saveDiaryImage(input.userId, id, "drawing", drawing, "image/png");
  }
  if (photo) {
    await saveDiaryImage(input.userId, id, "photo", photo, photoContentType);
  }

  const entry: DiaryEntry = {
    id,
    userId: input.userId,
    dateKey: todayKey(),
    createdAt: new Date().toISOString(),
    text,
    hasDrawing: Boolean(drawing),
    hasPhoto: Boolean(photo),
    drawingContentType: drawing ? "image/png" : undefined,
    photoContentType: photo ? photoContentType : undefined,
  };

  await saveDiaryEntry(entry);
  return toView(entry);
}
