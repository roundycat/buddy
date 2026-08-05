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
import { observeFailure } from "@/backend/shared/observability";
import { createMapStore } from "@/backend/shared/persist/map-store";
import type { PhotoAlbumItem } from "./photo-album.types";

const metaStore = createMapStore<PhotoAlbumItem>("photo-album.json", {
  userIdKey: "userId",
});

function resolveLocalDir(): string {
  const fromEnv = process.env.PHOTO_LOCAL_DIR?.trim();
  if (fromEnv) {
    if (!existsSync(fromEnv)) mkdirSync(fromEnv, { recursive: true });
    return fromEnv;
  }

  const preferred = path.join(process.cwd(), ".data", "photos");
  try {
    if (!existsSync(preferred)) mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), "bedi-photos");
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

function localPath(userId: string, photoId: string) {
  return path.join(localDir(), `${sanitize(userId)}__${sanitize(photoId)}.bin`);
}

function s3Key(userId: string, photoId: string) {
  return `photos/${sanitize(userId)}/${sanitize(photoId)}`;
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

export async function savePhotoBytes(
  userId: string,
  photoId: string,
  bytes: Buffer,
  contentType: string
): Promise<"s3" | "local"> {
  const bucket = env.avatar.s3Bucket;
  if (bucket) {
    const client = createS3();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key(userId, photoId),
          Body: bytes,
          ContentType: contentType,
          CacheControl: "private, max-age=120",
        })
      );
    } catch (error) {
      observeFailure({
        feature: "photo-album",
        operation: "s3_put",
        error,
        metricName: "S3WriteErrors",
      });
      throw error;
    }
    try {
      writeFileSync(localPath(userId, photoId), bytes);
    } catch {
      /* ignore local cache */
    }
    return "s3";
  }

  writeFileSync(localPath(userId, photoId), bytes);
  return "local";
}

export async function readPhotoBytes(
  userId: string,
  photoId: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const meta = await metaStore.get(photoId);
  if (!meta || meta.userId !== userId) return null;

  const local = localPath(userId, photoId);
  if (existsSync(local)) {
    return {
      bytes: readFileSync(local),
      contentType: meta.contentType,
    };
  }

  const bucket = env.avatar.s3Bucket;
  if (!bucket) return null;

  try {
    const client = createS3();
    const res = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: s3Key(userId, photoId),
      })
    );
    const body = res.Body;
    if (!body) return null;
    const bytes = Buffer.from(await body.transformToByteArray());
    try {
      writeFileSync(local, bytes);
    } catch {
      /* ignore */
    }
    return {
      bytes,
      contentType: meta.contentType || res.ContentType || "image/jpeg",
    };
  } catch (error) {
    console.warn("[photo-album] S3 read failed:", error);
    return null;
  }
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
  await metaStore.clearByUserId(userId);
}
