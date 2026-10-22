import "server-only";
import { createMapStore } from "@/backend/shared/persist/map-store";
import type { SafetyAssessment, SafetyLevel, SignalCategory } from "./types";

/**
 * Per-child safety signal log — levels and categories only, never message text.
 * Used to notice repeated watch-level signals ("지속적인 어려움") so Beddy can ask
 * the child whether a short note may be shared with the guardian.
 */

export interface SafetySignalEvent {
  at: string;
  level: SafetyLevel;
  categories: SignalCategory[];
}

export interface SafetySignalLog {
  childUserId: string;
  events: SafetySignalEvent[];
  lastConcernRequestAt?: string;
}

const MAX_EVENTS = 50;
const WINDOW_MS = 72 * 60 * 60 * 1000;
const PERSISTENT_THRESHOLD = 3;

const store = createMapStore<SafetySignalLog>("child-safety-signals.json", {
  userIdKey: "childUserId",
});

export interface SignalRecordResult {
  /** 3+ watch-or-higher signals in 72h and no concern request in that window */
  persistentDistress: boolean;
  recentCount: number;
}

export async function recordSafetySignal(
  childUserId: string,
  assessment: SafetyAssessment,
  now = new Date()
): Promise<SignalRecordResult> {
  if (assessment.level === "none") {
    return { persistentDistress: false, recentCount: 0 };
  }
  const prev = (await store.get(childUserId)) ?? { childUserId, events: [] };
  const events = [
    ...prev.events,
    { at: now.toISOString(), level: assessment.level, categories: assessment.categories },
  ].slice(-MAX_EVENTS);

  const since = now.getTime() - WINDOW_MS;
  const recent = events.filter(
    (e) =>
      new Date(e.at).getTime() >= since &&
      (e.level === "watch" || e.level === "elevated" || e.level === "urgent")
  );
  const askedRecently =
    prev.lastConcernRequestAt != null &&
    new Date(prev.lastConcernRequestAt).getTime() >= since;
  const persistentDistress =
    assessment.level === "watch" &&
    recent.length >= PERSISTENT_THRESHOLD &&
    !askedRecently;

  await store.set(childUserId, {
    childUserId,
    events,
    lastConcernRequestAt: persistentDistress
      ? now.toISOString()
      : prev.lastConcernRequestAt,
  });
  return { persistentDistress, recentCount: recent.length };
}

export async function getSafetySignalLog(
  childUserId: string
): Promise<SafetySignalLog | null> {
  return (await store.get(childUserId)) ?? null;
}

export async function clearSafetySignalsForUser(childUserId: string) {
  await store.clearByUserId(childUserId);
}
