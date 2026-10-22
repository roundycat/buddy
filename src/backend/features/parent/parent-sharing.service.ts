import "server-only";
import { getChildShareChoices } from "@/backend/features/sharing/sharing.service";
import { resolveGuardianVisibility } from "@/backend/features/sharing/share-policy";
import type { ShareCategory } from "@/backend/features/sharing/sharing.types";
import { getParentSettings, type ParentSettings } from "./parent-settings.store";
import type { ParentSharingFlags } from "./parent.types";

/**
 * The guardian's own view toggles mapped onto the child's share categories.
 * 「기억 · 사진 · 그림」 covers both memory highlights and media.
 */
export function guardianTogglesFromSettings(
  settings: ParentSettings
): Record<ShareCategory, boolean> {
  return {
    mood: settings.privacy.shareEmotionTrends,
    adventures: settings.privacy.shareAdventures,
    memoryHighlights: settings.privacy.shareMemoryHighlights,
    media: settings.privacy.shareMemoryHighlights,
  };
}

/** Child choice × guardian toggle, per category. */
export async function resolveGuardianSharing(
  guardianUserId: string,
  childUserId: string,
  settings?: ParentSettings
): Promise<ParentSharingFlags> {
  const [resolvedSettings, choices] = await Promise.all([
    settings ? Promise.resolve(settings) : getParentSettings(guardianUserId),
    getChildShareChoices(childUserId),
  ]);
  return resolveGuardianVisibility(
    choices,
    guardianTogglesFromSettings(resolvedSettings)
  );
}
