import "server-only";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import os from "os";
import path from "path";
import { env } from "@/backend/shared/config/env";

function resolveLocalDir(): string {
  const fromEnv = process.env.SCHEDULE_IMAGE_LOCAL_DIR?.trim();
  if (fromEnv) {
    if (!existsSync(fromEnv)) mkdirSync(fromEnv, { recursive: true });
    return fromEnv;
  }

  const preferred = path.join(process.cwd(), ".data", "schedule-images");
  try {
    if (!existsSync(preferred)) mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), "bedi-schedule-images");
    if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

let cachedLocalDir: string | null = null;

function localDir() {
  if (!cachedLocalDir) cachedLocalDir = resolveLocalDir();
  return cachedLocalDir;
}

function sanitize(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function localPath(itemId: string) {
  return path.join(localDir(), `${sanitize(itemId)}.png`);
}

function s3Key(itemId: string) {
  return `schedule-images/${sanitize(itemId)}.png`;
}

function createS3() {
  const { accessKeyId, secretAccessKey, sessionToken, region } = env.bedrock;
  return new S3Client({
    region: env.avatar.s3Region || region,
    ...(accessKeyId && secretAccessKey
      ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
            ...(sessionToken ? { sessionToken } : {}),
          },
        }
      : {}),
  });
}

export async function saveScheduleImage(
  itemId: string,
  bytes: Buffer
): Promise<void> {
  try {
    writeFileSync(localPath(itemId), bytes);
  } catch (error) {
    console.warn("[schedule-image.store] local write skipped:", error);
  }

  const bucket = env.avatar.s3Bucket;
  if (!bucket) return;

  try {
    const s3 = createS3();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key(itemId),
        Body: bytes,
        ContentType: "image/png",
      })
    );
  } catch (error) {
    console.warn("[schedule-image.store] S3 write skipped:", error);
  }
}

export async function readScheduleImage(
  itemId: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  try {
    const p = localPath(itemId);
    if (existsSync(p)) {
      return { bytes: readFileSync(p), contentType: "image/png" };
    }
  } catch {
    /* try S3 */
  }

  const bucket = env.avatar.s3Bucket;
  if (!bucket) return null;

  try {
    const s3 = createS3();
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: s3Key(itemId),
      })
    );
    const bytes = Buffer.from(await res.Body!.transformToByteArray());
    return { bytes, contentType: res.ContentType || "image/png" };
  } catch {
    return null;
  }
}
