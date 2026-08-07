import "server-only";
import { createMapStore } from "@/backend/shared/persist/map-store";
import { createBlobStore } from "@/backend/shared/persist/blob-store";
import type { DiaryEntry, DiaryImageKind } from "./picture-diary.types";

const entryStore = createMapStore<DiaryEntry>("picture-diary.json", {
  userIdKey: "userId",
});

/**
 * Diary art lives apart from the photo album on purpose — album photos feed the
 * garden / storybook memory cards, and diary pages stay inside the diary.
 */
const blobs = createBlobStore({
  prefix: "diary",
  localSubdir: "diary",
  feature: "picture-diary",
});

function blobId(entryId: string, kind: DiaryImageKind) {
  return `${entryId}-${kind}`;
}

export async function saveDiaryImage(
  userId: string,
  entryId: string,
  kind: DiaryImageKind,
  bytes: Buffer,
  contentType: string
) {
  return blobs.save(userId, blobId(entryId, kind), bytes, contentType);
}

export async function readDiaryImage(
  userId: string,
  entryId: string,
  kind: DiaryImageKind
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const entry = await entryStore.get(entryId);
  if (!entry || entry.userId !== userId) return null;
  if (kind === "drawing" && !entry.hasDrawing) return null;
  if (kind === "photo" && !entry.hasPhoto) return null;

  const bytes = await blobs.read(userId, blobId(entryId, kind));
  if (!bytes) return null;

  const contentType =
    (kind === "drawing" ? entry.drawingContentType : entry.photoContentType) ??
    "image/png";
  return { bytes, contentType };
}

export async function saveDiaryEntry(entry: DiaryEntry) {
  return entryStore.set(entry.id, entry);
}

export async function listDiaryEntriesForUser(
  userId: string
): Promise<DiaryEntry[]> {
  const all = await entryStore.values();
  return all
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Removes metadata and the drawing / photo bytes behind it. */
export async function clearDiaryForUser(userId: string) {
  const entries = await listDiaryEntriesForUser(userId);
  await Promise.all(
    entries.flatMap((entry) => [
      ...(entry.hasDrawing
        ? [blobs.remove(userId, blobId(entry.id, "drawing"))]
        : []),
      ...(entry.hasPhoto
        ? [blobs.remove(userId, blobId(entry.id, "photo"))]
        : []),
    ])
  );
  await entryStore.clearByUserId(userId);
}
