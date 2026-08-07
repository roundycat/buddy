import "server-only";
import { resolveLinkedChildUserId } from "@/backend/features/guardian-link/guardian-link.service";
import { DomainError } from "@/backend/shared/http/domain-error";
import { parseUploadedImage } from "@/backend/shared/media/image-upload";
import { todayKey } from "@/backend/shared/time/date";
import type { ParentLetterPage } from "./growth-storybook.types";
import {
  getStorybookParentLetter,
  saveStorybookParentLetterPhoto,
  saveStorybookParentLetter,
  type StoredStorybookParentLetter,
} from "./storybook-parent-letter.store";

const MAX_BODY = 2400;

/** Allow only the tiny formatting vocabulary exposed by the editor. */
export function sanitizeLetterHtml(html: string): string {
  return html
    .replace(/<(?!\/?(?:b|strong|i|em|br|p)\b)[^>]*>/gi, "")
    .replace(/\s(?:style|class|id|on\w+)=(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    .replace(/<(p|b|strong|i|em)(?:\s[^>]*)?>/gi, "<$1>")
    .slice(0, MAX_BODY * 2);
}

function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim()
    .slice(0, MAX_BODY);
}

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** True when the local calendar has reached the unlock day. */
export function isParentLetterUnlocked(
  dischargeDate: string | undefined,
  now: Date = new Date()
): boolean {
  // Legacy letters without a date stay readable.
  if (!dischargeDate || !isValidDateKey(dischargeDate)) return true;
  return todayKey(now) >= dischargeDate;
}

/**
 * Child-facing DTO. Sent letters appear immediately as an envelope; body and
 * photo stay redacted until dischargeDate.
 */
const LEGACY_LETTER_TITLES = new Set([
  "언제나 네 편인 우리에게서",
  "언제나 내편인 우리에게서",
  "언제나 내 편인 우리에게서",
]);

function sanitizeLetterTitle(title: string | undefined) {
  const t = title?.trim() ?? "";
  if (!t || LEGACY_LETTER_TITLES.has(t)) return "";
  return t;
}

export function toChildParentLetter(
  stored: StoredStorybookParentLetter | null | undefined
): ParentLetterPage | null {
  if (!stored) return null;
  // Legacy drafts saved before sentAt existed still count as transmitted.
  if (!stored.sentAt && !stored.body?.trim()) return null;

  const locked = !isParentLetterUnlocked(stored.dischargeDate);
  const base: ParentLetterPage = {
    title: sanitizeLetterTitle(stored.title),
    signature: stored.signature,
    date: stored.date,
    handwriting: stored.handwriting !== false,
    dischargeDate: stored.dischargeDate,
    sentAt: stored.sentAt ?? stored.updatedAt,
    locked,
    surprise: true,
    body: "",
  };

  if (locked) {
    return {
      ...base,
      body: "",
      bodyHtml: undefined,
      photoUrl: undefined,
    };
  }

  return {
    ...base,
    body: stored.body,
    bodyHtml: stored.bodyHtml,
    photoUrl: stored.hasPhoto
      ? stored.photoUrl ?? "/api/storybook/parent-letter/photo"
      : undefined,
  };
}

/** Live letter for the child's storybook (locked state follows the calendar). */
export async function getChildParentLetter(
  childUserId: string
): Promise<ParentLetterPage | null> {
  return toChildParentLetter(await getStorybookParentLetter(childUserId));
}

export async function getLetterForGuardian(guardianUserId: string) {
  const childUserId = await resolveLinkedChildUserId(guardianUserId);
  if (!childUserId) return { linked: false as const, letter: null };
  return {
    linked: true as const,
    letter: await getStorybookParentLetter(childUserId),
  };
}

/**
 * Parent hits send → letter is transmitted immediately.
 * The child sees the envelope right away; content unlocks on dischargeDate.
 */
export async function saveLetterForGuardian(input: {
  guardianUserId: string;
  bodyHtml: string;
  signature: string;
  date?: string;
  dischargeDate?: string;
  handwriting?: boolean;
  photoBase64?: string;
  photoContentType?: string;
}) {
  const childUserId = await resolveLinkedChildUserId(input.guardianUserId);
  if (!childUserId) {
    throw new DomainError("먼저 아이와 연결해 주세요.");
  }

  const bodyHtml = sanitizeLetterHtml(input.bodyHtml);
  const body = plainText(bodyHtml);
  if (!body) {
    throw new DomainError("아이에게 전할 편지를 적어 주세요.");
  }

  const signature = input.signature.trim().slice(0, 60);
  if (!signature) {
    throw new DomainError("편지를 쓴 사람의 이름을 적어 주세요.");
  }

  const dischargeDate = input.dischargeDate?.trim() || "";
  if (!dischargeDate || !isValidDateKey(dischargeDate)) {
    throw new DomainError("퇴원 예정일을 정해 주세요. 그날부터 아이가 편지를 열 수 있어요.");
  }

  const existing = await getStorybookParentLetter(childUserId);
  let hasPhoto = existing?.hasPhoto ?? false;
  let photoContentType = existing?.photoContentType;
  if (input.photoBase64) {
    const { bytes, contentType } = parseUploadedImage({
      base64: input.photoBase64,
      contentType: input.photoContentType,
      maxBytes: 8 * 1024 * 1024,
      typeMessage: "편지 사진은 JPEG, PNG, WebP만 올릴 수 있어요.",
      sizeMessage: "편지 사진은 8MB 이하로 올려 주세요.",
    });
    await saveStorybookParentLetterPhoto(childUserId, bytes, contentType);
    hasPhoto = true;
    photoContentType = contentType;
  }

  const now = new Date().toISOString();
  return saveStorybookParentLetter({
    childUserId,
    guardianUserId: input.guardianUserId,
    title: "",
    body,
    bodyHtml,
    signature,
    date: input.date?.trim() || todayKey(),
    dischargeDate,
    sentAt: existing?.sentAt ?? now,
    surprise: true,
    handwriting: input.handwriting !== false,
    photoUrl: hasPhoto ? "/api/storybook/parent-letter/photo" : undefined,
    hasPhoto,
    photoContentType,
    updatedAt: now,
  });
}
