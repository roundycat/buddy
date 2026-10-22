import "server-only";
import { createMapStore } from "@/backend/shared/persist/map-store";
import type { ParentEmpathyGuide } from "@/backend/features/parent/parent.types";
import { todayKey } from "@/backend/shared/time/date";

/**
 * Pre-generated guardian home slices (STEP 4 job 3).
 * Kept separate from parent.service to avoid import cycles with the batch job.
 */
export interface ParentDailyPrepRecord {
  guardianUserId: string;
  childUserId: string;
  dateKey: string;
  empathyGuide: ParentEmpathyGuide | null;
  todayMessage: string | null;
  /** Sharing visibility the slices were built with; stale when it changes */
  visibilityKey?: string;
  preparedAt: string;
}

const store = createMapStore<ParentDailyPrepRecord>("parent-daily-prep.json", {
  userIdKey: "guardianUserId",
});

export function parentPrepKey(guardianUserId: string, dateKey: string) {
  return `${guardianUserId}:${dateKey}`;
}

export async function savePreparedParentSummary(
  record: ParentDailyPrepRecord
): Promise<ParentDailyPrepRecord> {
  return store.set(
    parentPrepKey(record.guardianUserId, record.dateKey),
    record
  );
}

export async function getPreparedParentSummary(
  guardianUserId: string,
  dateKey = todayKey()
): Promise<ParentDailyPrepRecord | null> {
  return (await store.get(parentPrepKey(guardianUserId, dateKey))) ?? null;
}
