import "server-only";
import { createBlobStore } from "@/backend/shared/persist/blob-store";

/**
 * Soft schedule card illustrations.
 * Legacy layout: schedule-images/{itemId}.png (local + S3).
 */
const IMAGE = "image";

const blobs = createBlobStore({
  prefix: "schedule-images",
  localSubdir: "schedule-images",
  feature: "schedule-image",
  localDirEnv: "SCHEDULE_IMAGE_LOCAL_DIR",
  s3Key: (itemId) => `schedule-images/${itemId}.png`,
  localFileName: (itemId) => `${itemId}.png`,
});

export async function saveScheduleImage(
  itemId: string,
  bytes: Buffer
): Promise<void> {
  await blobs.save(itemId, IMAGE, bytes, "image/png");
}

export async function readScheduleImage(
  itemId: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  return blobs.readWithType(itemId, IMAGE, "image/png");
}

export async function removeScheduleImage(itemId: string): Promise<void> {
  await blobs.remove(itemId, IMAGE);
}
