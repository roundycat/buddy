/**
 * Shared image upload validation for diary / album / storybook letter.
 */

import { DomainError } from "@/backend/shared/http/domain-error";

export const ALLOWED_UPLOAD_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function normalizeImageContentType(
  value: string | undefined,
  fallback = "image/jpeg"
): string {
  return (value || fallback).toLowerCase().split(";")[0]!.trim();
}

/** Strip a data-URL prefix if present, then decode base64 into bytes. */
export function decodeBase64Image(raw: string): Buffer {
  const stripped = raw.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(stripped, "base64");
}

export function assertAllowedImageType(
  contentType: string,
  message = "사진(JPEG/PNG/WebP)만 올릴 수 있어요."
): void {
  if (!ALLOWED_UPLOAD_IMAGE_TYPES.has(contentType)) {
    throw new DomainError(message);
  }
}

export function assertImageSize(
  bytes: Buffer,
  maxBytes: number,
  message?: string
): void {
  if (bytes.length === 0 || bytes.length > maxBytes) {
    throw new DomainError(
      message ??
        `사진 크기는 ${Math.round(maxBytes / (1024 * 1024))}MB 이하로 올려 주세요.`
    );
  }
}

/** Decode + validate a client-uploaded base64 image in one step. */
export function parseUploadedImage(input: {
  base64: string;
  contentType?: string;
  maxBytes: number;
  typeMessage?: string;
  sizeMessage?: string;
}): { bytes: Buffer; contentType: string } {
  const contentType = normalizeImageContentType(input.contentType);
  assertAllowedImageType(contentType, input.typeMessage);
  const bytes = decodeBase64Image(input.base64);
  assertImageSize(bytes, input.maxBytes, input.sizeMessage);
  return { bytes, contentType };
}
