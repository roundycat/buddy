import "server-only";
import { DomainError } from "@/backend/shared/http/domain-error";
import { guardGuardianText } from "@/backend/ai/bridge/leak-guard";
import { recentChildWording } from "@/backend/ai/bridge/child-wording";
import { decideShare } from "./share-policy";
import {
  getConcernRequest,
  listConcernRequestsForChild,
  saveConcernRequest,
  type ConcernNotice,
  type ConcernRequest,
} from "./concern-request.store";

export type { ConcernNotice, ConcernRequest } from "./concern-request.store";

/** Safe wording when the caller's summary is empty or would leak chat. */
export const DEFAULT_CONCERN_SUMMARY = "요즘 마음이 조금 힘들어 보여요.";

const SUMMARY_MAX = 120;
/** After "아직은 싫어", do not ask again for a day. */
const DECLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Guardians see approved notices for two weeks. */
const NOTICE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const NOTICE_LIMIT = 3;

function ageMs(iso: string | undefined, now = Date.now()) {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? now - t : Number.POSITIVE_INFINITY;
}

/**
 * Ask the child before a persistent-distress notice reaches a guardian
 * (share-policy "ask_child"). Returns the request the child will see,
 * or null while a recent "아직은 싫어" is still being respected.
 */
export async function requestChildConsentForConcern(
  childUserId: string,
  summary: string
): Promise<ConcernRequest | null> {
  const existing = await listConcernRequestsForChild(childUserId);
  const pending = existing.find((r) => r.status === "pending");
  if (pending) return pending;

  const recentlyDeclined = existing.some(
    (r) => r.status === "declined" && ageMs(r.answeredAt) < DECLINE_COOLDOWN_MS
  );
  if (recentlyDeclined) return null;

  const trimmed = (summary ?? "").replace(/\s+/g, " ").trim().slice(0, SUMMARY_MAX);
  const childWording = await recentChildWording(childUserId);
  const safeSummary = trimmed
    ? guardGuardianText(trimmed, childWording, DEFAULT_CONCERN_SUMMARY).text
    : DEFAULT_CONCERN_SUMMARY;

  return saveConcernRequest({
    id: `concern-${crypto.randomUUID()}`,
    childUserId,
    summary: safeSummary,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}

export async function getPendingConcernRequest(
  childUserId: string
): Promise<ConcernRequest | null> {
  const list = await listConcernRequestsForChild(childUserId);
  return list.find((r) => r.status === "pending") ?? null;
}

/** Child answers 알려도 돼 (approve) / 아직은 싫어 (decline). */
export async function answerConcernRequest(
  childUserId: string,
  requestId: string,
  approve: boolean
): Promise<ConcernRequest> {
  const request = requestId
    ? await getConcernRequest(childUserId, requestId)
    : null;
  if (!request) {
    throw new DomainError("질문을 찾을 수 없어요.", "NOT_FOUND");
  }
  if (request.status !== "pending") {
    throw new DomainError("이미 답한 질문이에요.", "CONFLICT");
  }
  return saveConcernRequest({
    ...request,
    status: approve ? "approved" : "declined",
    answeredAt: new Date().toISOString(),
  });
}

/** Approved notices for the guardian home — summary only. */
export async function listSharedConcernNotices(
  childUserId: string
): Promise<ConcernNotice[]> {
  const list = await listConcernRequestsForChild(childUserId);
  return list
    .filter(
      (r) =>
        r.status !== "pending" &&
        ageMs(r.answeredAt) < NOTICE_WINDOW_MS &&
        decideShare({
          kind: "concern",
          childChoice: r.status === "approved" ? "share" : "private",
        }).decision === "share"
    )
    .slice(0, NOTICE_LIMIT)
    .map((r) => ({
      id: r.id,
      summary: r.summary,
      sharedAt: r.answeredAt ?? r.createdAt,
    }));
}
