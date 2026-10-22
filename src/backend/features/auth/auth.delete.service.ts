import { clearGuardianDataForUser } from "@/backend/features/guardian-link/guardian-link.store";
import {
  anonymizeGuardianConsentRecords,
  clearConsentForUser,
} from "@/backend/features/consent/consent.store";
import { eraseChildCollectedData } from "@/backend/features/privacy/child-data-erase";
import { clearParentPrepForGuardian } from "@/backend/features/parent/parent-daily-prep.store";
import { clearEmpathyGuidesForGuardian } from "@/backend/features/parent/parent-empathy-guide.store";
import { clearParentSettingsForGuardian } from "@/backend/features/parent/parent-settings.store";
import type { AuthUser } from "./auth.types";
import { deleteUser } from "./auth.users.repo";

/**
 * Account deletion (회원 탈퇴): every record in every store, then the login row.
 * Child data goes through the same eraser as consent withdrawal; guardian-side
 * records (settings, prepared summaries, empathy guides, links) are removed too,
 * and consent records the account gave as a guardian lose the guardian's name.
 * Clearing is keyed by user id, so running both halves for any account is safe.
 */
export async function deleteAccount(user: AuthUser): Promise<void> {
  await eraseChildCollectedData(user.id);
  await Promise.all([
    clearConsentForUser(user.id),
    // Consents this account gave as a guardian stay as proof, without the name.
    anonymizeGuardianConsentRecords(user.id),
    clearParentPrepForGuardian(user.id),
    clearEmpathyGuidesForGuardian(user.id),
    clearParentSettingsForGuardian(user.id),
  ]);
  // Links last: the eraser above uses them to find guardian-side summaries.
  await clearGuardianDataForUser(user.id);
  await deleteUser(user.id);
}
