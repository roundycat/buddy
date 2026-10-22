import { createMapStore } from "@/backend/shared/persist/map-store";
import type { ParentEmpathyGuide } from "./parent.types";

/**
 * Daily empathy guide cache.
 * PERSISTENCE=dynamodb → DynamoDB map store (production path).
 * PERSISTENCE=json → local .data file.
 */
export interface ParentEmpathyGuideRecord {
  id: string;
  guardianUserId: string;
  childUserId: string;
  dateKey: string;
  /** Invalidates cache when onboarding traits change */
  profileFingerprint: string;
  guide: ParentEmpathyGuide;
  updatedAt: string;
}

const store = createMapStore<ParentEmpathyGuideRecord>(
  "parent-empathy-guides.json",
  { userIdKey: "guardianUserId" }
);

export function empathyGuideKey(
  guardianUserId: string,
  dateKey: string
): string {
  return `${guardianUserId}:${dateKey}`;
}

export async function getStoredEmpathyGuide(
  guardianUserId: string,
  dateKey: string,
  profileFingerprint?: string
): Promise<ParentEmpathyGuide | null> {
  const row = await store.get(empathyGuideKey(guardianUserId, dateKey));
  if (!row?.guide) return null;
  if (
    profileFingerprint != null &&
    row.profileFingerprint !== profileFingerprint
  ) {
    return null;
  }
  return row.guide;
}

export async function saveEmpathyGuide(input: {
  guardianUserId: string;
  childUserId: string;
  profileFingerprint: string;
  guide: ParentEmpathyGuide;
}): Promise<ParentEmpathyGuide> {
  const id = empathyGuideKey(input.guardianUserId, input.guide.dateKey);
  await store.set(id, {
    id,
    guardianUserId: input.guardianUserId,
    childUserId: input.childUserId,
    dateKey: input.guide.dateKey,
    profileFingerprint: input.profileFingerprint,
    guide: input.guide,
    updatedAt: new Date().toISOString(),
  });
  return input.guide;
}

export async function clearEmpathyGuidesForGuardian(guardianUserId: string) {
  await store.clearByUserId(guardianUserId);
}
