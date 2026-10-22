import "server-only";
import { getParentHome } from "@/backend/features/parent/parent.service";
import {
  savePreparedParentSummary,
  getPreparedParentSummary,
} from "@/backend/features/parent/parent-daily-prep.store";
import { resolveLinkedChildUserId } from "@/backend/features/guardian-link/guardian-link.service";
import { isChildConsentPending } from "@/backend/features/consent/consent.guard";
import { guardianVisibilityKey } from "@/backend/features/sharing/share-policy";
import { todayKey } from "@/backend/shared/time/date";

export {
  getPreparedParentSummary,
  type ParentDailyPrepRecord,
} from "@/backend/features/parent/parent-daily-prep.store";

/**
 * Job 3 — Pre-generate guardian empathy / home summaries for the morning.
 */
export async function prepareParentSummaryForGuardian(
  guardianUserId: string,
  dateKey = todayKey()
): Promise<{ guardianUserId: string; ok: boolean }> {
  try {
    const childUserId = await resolveLinkedChildUserId(guardianUserId);
    if (!childUserId || (await isChildConsentPending(childUserId))) {
      return { guardianUserId, ok: true };
    }
    const home = await getParentHome(guardianUserId, { preferPrepared: false });
    await savePreparedParentSummary({
      guardianUserId,
      childUserId,
      dateKey,
      empathyGuide: home.empathyGuide,
      todayMessage: home.todayMessage?.text ?? null,
      visibilityKey: home.sharing ? guardianVisibilityKey(home.sharing) : undefined,
      preparedAt: new Date().toISOString(),
    });
    return { guardianUserId, ok: true };
  } catch (error) {
    console.error("[batch.parent-summary]", guardianUserId, error);
    return { guardianUserId, ok: false };
  }
}
