import "server-only";
import { createMapStore } from "@/backend/shared/persist/map-store";

/**
 * Concern consent requests — before a guardian hears "요즘 마음이 힘들어 보여요",
 * the child is asked first. Only the summary ever reaches the guardian.
 */

export type ConcernRequestStatus = "pending" | "approved" | "declined";

export interface ConcernRequest {
  id: string;
  childUserId: string;
  /** Guardian-facing summary only — never chat wording */
  summary: string;
  status: ConcernRequestStatus;
  createdAt: string;
  answeredAt?: string;
}

/** What a guardian sees once the child said "알려도 돼". */
export interface ConcernNotice {
  id: string;
  summary: string;
  sharedAt: string;
}

const store = createMapStore<ConcernRequest>("concern-requests.json", {
  userIdKey: "childUserId",
});

function key(childUserId: string, id: string) {
  return `${childUserId}:${id}`;
}

export async function saveConcernRequest(
  request: ConcernRequest
): Promise<ConcernRequest> {
  return store.set(key(request.childUserId, request.id), request);
}

export async function getConcernRequest(
  childUserId: string,
  id: string
): Promise<ConcernRequest | null> {
  return (await store.get(key(childUserId, id))) ?? null;
}

/** Newest first. */
export async function listConcernRequestsForChild(
  childUserId: string
): Promise<ConcernRequest[]> {
  const all = await store.values();
  return all
    .filter((r) => r.childUserId === childUserId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function clearConcernRequestsForUser(userId: string) {
  await store.clearByUserId(userId);
}
