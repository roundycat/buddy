import "server-only";
import { createMapStore } from "@/backend/shared/persist/map-store";
import type {
  ChildConsentState,
  GuardianConsentRecord,
} from "./consent.types";

/**
 * Consent persistence.
 *   child-consent      — one gate row per child (key: childUserId)
 *   guardian-consents  — guardian consent proofs (key: childUserId:id), kept after withdrawal
 */

const childStates = createMapStore<ChildConsentState>("child-consent.json", {
  userIdKey: "childUserId",
});

const guardianConsents = createMapStore<GuardianConsentRecord>(
  "guardian-consents.json",
  { userIdKey: "childUserId" }
);

export async function getChildConsentState(
  childUserId: string
): Promise<ChildConsentState | null> {
  return (await childStates.get(childUserId)) ?? null;
}

export async function saveChildConsentState(
  state: ChildConsentState
): Promise<ChildConsentState> {
  return childStates.set(state.childUserId, state);
}

export async function deleteChildConsentState(childUserId: string) {
  await childStates.delete(childUserId);
}

function recordKey(record: Pick<GuardianConsentRecord, "childUserId" | "id">) {
  return `${record.childUserId}:${record.id}`;
}

export async function saveGuardianConsentRecord(
  record: GuardianConsentRecord
): Promise<GuardianConsentRecord> {
  return guardianConsents.set(recordKey(record), record);
}

/** Newest first, withdrawn records included. */
export async function listGuardianConsentsForChild(
  childUserId: string
): Promise<GuardianConsentRecord[]> {
  const all = await guardianConsents.values();
  return all
    .filter((r) => r.childUserId === childUserId)
    .sort((a, b) => (a.consentedAt < b.consentedAt ? 1 : -1));
}

export async function clearConsentForUser(userId: string) {
  await Promise.all([
    childStates.delete(userId),
    guardianConsents.clearByUserId(userId),
  ]);
}
