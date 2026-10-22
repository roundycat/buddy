import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { unlink } from "fs/promises";
import os from "os";
import path from "path";
import { env } from "@/backend/shared/config/env";
import { observeFailure } from "@/backend/shared/observability";
import { dataDir } from "@/backend/shared/persist/json-file";

/**
 * Owner-scoped binary storage.
 * Cloud: private S3 under `${prefix}/${ownerId}/${blobId}` with a local mirror.
 * Local: `${BEDDY_DATA_DIR or .data}/${localSubdir}` (falls back to the OS temp dir).
 *
 * Callers own the metadata — this only moves bytes.
 * Optional key builders preserve legacy S3/local layouts during migrations.
 */
export interface BlobStore {
  save(
    ownerId: string,
    blobId: string,
    bytes: Buffer,
    contentType: string
  ): Promise<"s3" | "local">;
  read(ownerId: string, blobId: string): Promise<Buffer | null>;
  /** Read bytes + content type when available (S3 metadata or fallback). */
  readWithType(
    ownerId: string,
    blobId: string,
    fallbackContentType?: string
  ): Promise<{ bytes: Buffer; contentType: string } | null>;
  remove(ownerId: string, blobId: string): Promise<void>;
}

export function sanitizeBlobId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
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

export function createBlobStore(options: {
  /** S3 key prefix, e.g. "diary-drawings" */
  prefix: string;
  /** Directory under .data for local bytes */
  localSubdir: string;
  /** Feature tag for failure metrics */
  feature: string;
  /** Override S3 object key (defaults to prefix/ownerId/blobId). */
  s3Key?: (ownerId: string, blobId: string) => string;
  /** Override local file name under localDir (defaults to owner__blob.bin). */
  localFileName?: (ownerId: string, blobId: string) => string;
  /** Prefer env override for local dir (e.g. AVATAR_LOCAL_DIR). */
  localDirEnv?: string;
}): BlobStore {
  let cachedDir: string | null = null;

  function localDir() {
    if (cachedDir) return cachedDir;
    const fromEnv = options.localDirEnv
      ? process.env[options.localDirEnv]?.trim()
      : undefined;
    if (fromEnv) {
      if (!existsSync(fromEnv)) mkdirSync(fromEnv, { recursive: true });
      cachedDir = fromEnv;
      return cachedDir;
    }
    const preferred = path.join(dataDir(), options.localSubdir);
    try {
      if (!existsSync(preferred)) mkdirSync(preferred, { recursive: true });
      cachedDir = preferred;
    } catch {
      const fallback = path.join(os.tmpdir(), `bedi-${options.localSubdir}`);
      if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true });
      cachedDir = fallback;
    }
    return cachedDir;
  }

  function resolveLocalPath(ownerId: string, blobId: string) {
    const name = options.localFileName
      ? options.localFileName(sanitizeBlobId(ownerId), sanitizeBlobId(blobId))
      : `${sanitizeBlobId(ownerId)}__${sanitizeBlobId(blobId)}.bin`;
    return path.join(localDir(), name);
  }

  function resolveS3Key(ownerId: string, blobId: string) {
    if (options.s3Key) {
      return options.s3Key(sanitizeBlobId(ownerId), sanitizeBlobId(blobId));
    }
    return `${options.prefix}/${sanitizeBlobId(ownerId)}/${sanitizeBlobId(blobId)}`;
  }

  async function readBytes(
    ownerId: string,
    blobId: string
  ): Promise<{ bytes: Buffer; contentType?: string } | null> {
    const local = resolveLocalPath(ownerId, blobId);
    if (existsSync(local)) {
      return { bytes: readFileSync(local) };
    }

    const bucket = env.avatar.s3Bucket;
    if (!bucket) return null;

    try {
      const res = await createS3().send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: resolveS3Key(ownerId, blobId),
        })
      );
      if (!res.Body) return null;
      const bytes = Buffer.from(await res.Body.transformToByteArray());
      try {
        writeFileSync(local, bytes);
      } catch {
        /* ignore */
      }
      return { bytes, contentType: res.ContentType };
    } catch (error) {
      console.warn(`[${options.feature}] S3 read failed:`, error);
      return null;
    }
  }

  return {
    async save(ownerId, blobId, bytes, contentType) {
      const bucket = env.avatar.s3Bucket;
      if (!bucket) {
        try {
          writeFileSync(resolveLocalPath(ownerId, blobId), bytes);
        } catch (error) {
          observeFailure({
            feature: options.feature,
            operation: "local_write",
            error,
            metricName: "StorageErrors",
          });
          throw error;
        }
        return "local";
      }

      try {
        await createS3().send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: resolveS3Key(ownerId, blobId),
            Body: bytes,
            ContentType: contentType,
            CacheControl: "private, max-age=120",
          })
        );
      } catch (error) {
        observeFailure({
          feature: options.feature,
          operation: "s3_put",
          error,
          metricName: "S3WriteErrors",
        });
        throw error;
      }

      try {
        writeFileSync(resolveLocalPath(ownerId, blobId), bytes);
      } catch {
        /* local mirror is best effort */
      }
      return "s3";
    },

    async read(ownerId, blobId) {
      const result = await readBytes(ownerId, blobId);
      return result?.bytes ?? null;
    },

    async readWithType(ownerId, blobId, fallbackContentType = "application/octet-stream") {
      const result = await readBytes(ownerId, blobId);
      if (!result) return null;
      return {
        bytes: result.bytes,
        contentType: result.contentType || fallbackContentType,
      };
    },

    async remove(ownerId, blobId) {
      // unlink, not rmSync — rmSync hard-crashes Node on OneDrive-synced paths.
      await unlink(resolveLocalPath(ownerId, blobId)).catch(() => {
        /* already gone */
      });

      const bucket = env.avatar.s3Bucket;
      if (!bucket) return;

      try {
        await createS3().send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: resolveS3Key(ownerId, blobId),
          })
        );
      } catch (error) {
        console.warn(`[${options.feature}] S3 delete failed:`, error);
      }
    },
  };
}
