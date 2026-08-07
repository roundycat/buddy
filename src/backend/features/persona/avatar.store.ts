import "server-only";
import { createBlobStore } from "@/backend/shared/persist/blob-store";

/**
 * Crayon persona avatars.
 * Legacy layout preserved:
 *   S3:    avatars/{userId}.png | avatars/{userId}__c{n}.png
 *   local: {userId}.png | {userId}__c{n}.png
 */
const ACTIVE = "active";

function blobIdFor(candidate?: string) {
  return candidate !== undefined && candidate !== ""
    ? `c${candidate}`
    : ACTIVE;
}

const blobs = createBlobStore({
  prefix: "avatars",
  localSubdir: "avatars",
  feature: "avatar",
  localDirEnv: "AVATAR_LOCAL_DIR",
  s3Key: (ownerId, blobId) =>
    blobId === ACTIVE
      ? `avatars/${ownerId}.png`
      : `avatars/${ownerId}__${blobId}.png`,
  localFileName: (ownerId, blobId) =>
    blobId === ACTIVE ? `${ownerId}.png` : `${ownerId}__${blobId}.png`,
});

export async function saveAvatarImage(
  userId: string,
  bytes: Buffer,
  contentType: string,
  candidate?: string
): Promise<{ stored: "s3" | "local"; key: string }> {
  const blobId = blobIdFor(candidate);
  const stored = await blobs.save(userId, blobId, bytes, contentType);
  const key =
    blobId === ACTIVE
      ? `avatars/${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`
      : `avatars/${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}__${blobId}.png`;
  return { stored, key };
}

export async function readAvatarImage(
  userId: string,
  candidate?: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  return blobs.readWithType(userId, blobIdFor(candidate), "image/png");
}

/** Promote a candidate image to the active avatar. */
export async function selectAvatarCandidate(
  userId: string,
  candidate: string
): Promise<boolean> {
  const source = await readAvatarImage(userId, candidate);
  if (!source) return false;
  await saveAvatarImage(userId, source.bytes, source.contentType);
  return true;
}

export async function deleteAvatarImage(userId: string): Promise<void> {
  await Promise.all([
    blobs.remove(userId, ACTIVE),
    blobs.remove(userId, "c0"),
    blobs.remove(userId, "c1"),
    blobs.remove(userId, "c2"),
  ]);
}
