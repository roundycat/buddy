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
  unlinkSync,
} from "fs";
import os from "os";
import path from "path";
import { env } from "@/backend/shared/config/env";

/**
 * Prefer /tmp in containers (ECS nextjs user cannot mkdir under /app).
 * Local dev can still use project .data when writable.
 */
function resolveLocalDir(): string {
  const fromEnv = process.env.AVATAR_LOCAL_DIR?.trim();
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      mkdirSync(fromEnv, { recursive: true });
    }
    return fromEnv;
  }

  const preferred = path.join(process.cwd(), ".data", "avatars");
  try {
    if (!existsSync(preferred)) {
      mkdirSync(preferred, { recursive: true });
    }
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), "bedi-avatars");
    if (!existsSync(fallback)) {
      mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}

let cachedLocalDir: string | null = null;

function localDir() {
  if (!cachedLocalDir) cachedLocalDir = resolveLocalDir();
  return cachedLocalDir;
}

function sanitize(userId: string) {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function localPath(userId: string, candidate?: string) {
  const base = sanitize(userId);
  const name =
    candidate !== undefined && candidate !== ""
      ? `${base}__c${candidate}.png`
      : `${base}.png`;
  return path.join(localDir(), name);
}

function s3Key(userId: string, candidate?: string) {
  const base = sanitize(userId);
  return candidate !== undefined && candidate !== ""
    ? `avatars/${base}__c${candidate}.png`
    : `avatars/${base}.png`;
}

function createS3() {
  const { accessKeyId, secretAccessKey, sessionToken, region } = env.bedrock;
  return new S3Client({
    region: env.avatar.s3Region || region,
    // Prefer task-role credentials in ECS; only inject static keys when present.
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

function tryWriteLocal(userId: string, bytes: Buffer, candidate?: string) {
  try {
    writeFileSync(localPath(userId, candidate), bytes);
    return true;
  } catch (error) {
    console.warn("[avatar.store] local write skipped:", error);
    return false;
  }
}

export async function saveAvatarImage(
  userId: string,
  bytes: Buffer,
  contentType: string,
  candidate?: string
): Promise<{ stored: "s3" | "local"; key: string }> {
  const bucket = env.avatar.s3Bucket;

  if (bucket) {
    const key = s3Key(userId, candidate);
    const client = createS3();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "private, max-age=60",
      })
    );
    // Best-effort local cache — must not fail the request in ECS.
    tryWriteLocal(userId, bytes, candidate);
    return { stored: "s3", key };
  }

  if (!tryWriteLocal(userId, bytes, candidate)) {
    throw new Error("아바타를 저장할 수 없어요. 저장소를 확인해 주세요.");
  }
  return { stored: "local", key: localPath(userId, candidate) };
}

export async function readAvatarImage(
  userId: string,
  candidate?: string
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const bucket = env.avatar.s3Bucket;
  if (bucket) {
    try {
      const client = createS3();
      const res = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: s3Key(userId, candidate),
        })
      );
      const body = res.Body;
      if (!body) return null;
      const bytes = Buffer.from(await body.transformToByteArray());
      return {
        bytes,
        contentType: res.ContentType || "image/png",
      };
    } catch (error) {
      console.warn("[avatar.store] S3 read failed, trying local", error);
    }
  }

  try {
    const file = localPath(userId, candidate);
    if (!existsSync(file)) return null;
    return {
      bytes: readFileSync(file),
      contentType: "image/png",
    };
  } catch {
    return null;
  }
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
  try {
    for (const suffix of ["", "__c0", "__c1", "__c2"]) {
      const file =
        suffix === ""
          ? localPath(userId)
          : path.join(localDir(), `${sanitize(userId)}${suffix}.png`);
      if (existsSync(file)) unlinkSync(file);
    }
  } catch {
    // ignore local cleanup errors
  }
}
