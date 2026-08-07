import "server-only";
import { createBlobStore } from "@/backend/shared/persist/blob-store";
import { createMapStore } from "@/backend/shared/persist/map-store";
import type { PhotoAlbumItem } from "./photo-album.types";

const metaStore = createMapStore<PhotoAlbumItem>("photo-album.json", {
  userIdKey: "userId",
});

/** Bytes: photos/{userId}/{photoId} — matches legacy layout. */
const blobs = createBlobStore({
  prefix: "photos",
  localSubdir: "photos",
  feature: "photo-album",
  localDirEnv: "PHOTO_LOCAL_DIR",
});

export async function savePhotoBytes(
  userId: string,
  photoId: string,
  bytes: Buffer,
  contentType: string
): Promise<"s3" | "local"> {
  return blobs.save(userId, photoId, bytes, contentType);
}

export async function readPhotoBytes(
  userId: string,
  photoId: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const meta = await metaStore.get(photoId);
  if (!meta || meta.userId !== userId) return null;

  const result = await blobs.readWithType(
    userId,
    photoId,
    meta.contentType || "image/jpeg"
  );
  if (!result) return null;
  return {
    bytes: result.bytes,
    contentType: meta.contentType || result.contentType,
  };
}

export async function savePhotoMeta(item: PhotoAlbumItem) {
  return metaStore.set(item.id, item);
}

export async function getPhotoMeta(photoId: string) {
  return (await metaStore.get(photoId)) ?? null;
}

export async function listPhotosForUser(userId: string) {
  const all = await metaStore.values();
  return all
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function clearPhotosForUser(userId: string) {
  const photos = await listPhotosForUser(userId);
  await Promise.all(photos.map((p) => blobs.remove(userId, p.id)));
  await metaStore.clearByUserId(userId);
}
