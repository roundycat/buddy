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
  /** A later signal while this alert was still open (keeps it open for 48h more). */
  lastSignalAt?: string;
  acknowledgedAt?: string;
}

const ACTIVE_MS = 48 * 60 * 60 * 1000;

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
  // An open urgent alert is never replaced by a milder one before the guardian
  // has seen it; the later signal only keeps it open longer.
  const open = await getActiveChildSafetyAlert(input.childUserId);
  if (open?.level === "urgent" && input.level === "elevated") {
    const kept: ChildSafetyAlert = { ...open, lastSignalAt: new Date().toISOString() };
    await alertStore.set(input.childUserId, kept);
    return kept;
  }
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
  const ageMs = Date.now() - new Date(alert.lastSignalAt ?? alert.createdAt).getTime();
  if (ageMs > ACTIVE_MS) return null;
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
