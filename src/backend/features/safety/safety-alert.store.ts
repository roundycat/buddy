import "server-only";
import { createMapStore } from "@/backend/shared/persist/map-store";
import type { CrisisActionId } from "@/backend/ai/safety/crisis-detect";

export interface ChildSafetyAlert {
  id: string;
  childUserId: string;
  /** Summary only — never raw chat */
  summary: string;
  level: "elevated" | "urgent";
  createdAt: string;
  acknowledgedAt?: string;
}

export type { CrisisActionId };

const alertStore = createMapStore<ChildSafetyAlert>(
  "child-safety-alerts.json",
  { userIdKey: "childUserId" }
);

export async function createChildSafetyAlert(input: {
  childUserId: string;
  summary: string;
  level: "elevated" | "urgent";
}): Promise<ChildSafetyAlert> {
  const alert: ChildSafetyAlert = {
    id: `alert-${Date.now()}`,
    childUserId: input.childUserId,
    summary: input.summary,
    level: input.level,
    createdAt: new Date().toISOString(),
  };
  await alertStore.set(input.childUserId, alert);
  return alert;
}

export async function getActiveChildSafetyAlert(childUserId: string) {
  const alert = await alertStore.get(childUserId);
  if (!alert) return null;
  if (alert.acknowledgedAt) return null;
  const ageMs = Date.now() - new Date(alert.createdAt).getTime();
  if (ageMs > 48 * 60 * 60 * 1000) return null;
  return alert;
}

export async function acknowledgeChildSafetyAlert(childUserId: string) {
  const alert = await alertStore.get(childUserId);
  if (!alert) return null;
  const next = {
    ...alert,
    acknowledgedAt: new Date().toISOString(),
  };
  await alertStore.set(childUserId, next);
  return next;
}

export async function clearSafetyAlertsForUser(childUserId: string) {
  await alertStore.clearByUserId(childUserId);
}
