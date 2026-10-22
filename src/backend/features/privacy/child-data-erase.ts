import "server-only";
import { clearPersonaForUser } from "@/backend/features/persona/persona.store";
import { deleteAvatarImage } from "@/backend/features/persona/avatar.store";
import { clearConversationForUser } from "@/backend/features/conversation/conversation.store";
import { clearWalletForUser } from "@/backend/features/wallet/wallet.store";
import { clearGardenForUser } from "@/backend/features/emotion-garden/emotion-garden.store";
import { clearAdventurePacksForUser } from "@/backend/features/adventure-quest/adventure-quest.store";
import { clearMemoryEventsForUser } from "@/backend/features/memory-timeline/memory-timeline.store";
import { clearWishTreeForUser } from "@/backend/features/wish-tree/wish-tree.store";
import { clearDiaryForUser } from "@/backend/features/picture-diary/picture-diary.store";
import { clearPhotosForUser } from "@/backend/features/photo-album/photo-album.store";
import { clearDischargeTale } from "@/backend/features/growth-storybook/growth-storybook.store";
import { clearStorybookParentLetter } from "@/backend/features/growth-storybook/storybook-parent-letter.store";
import { clearStorybookIllustrations } from "@/backend/features/growth-storybook/storybook-illustration.service";
import { clearMemoryLetters } from "@/backend/features/memory-post/memory-post.store";
import { clearEmotionForUser } from "@/backend/features/emotion-analysis/emotion.store";
import { clearBondForUser } from "@/backend/features/companion-bond/bond.store";
import { clearScheduleForChild } from "@/backend/features/hospital-day/hospital-day.store";
import { removeScheduleImage } from "@/backend/features/hospital-day/schedule-image.store";
import { clearCoarseLocationForUser } from "@/backend/features/weather/weather.store";
import { clearSafetySignalsForUser } from "@/backend/ai/safety/v2/signal-log.store";
import { clearSafetyAlertsForUser } from "@/backend/features/safety/safety-alert.store";
import { clearSharingForUser } from "@/backend/features/sharing/sharing.store";
import { clearConcernRequestsForUser } from "@/backend/features/sharing/concern-request.store";
import { clearKbSummariesForChild } from "@/backend/ai/kb/index-summaries";
import {
  getLinkForGuardian,
  listGuardianUserIds,
} from "@/backend/features/guardian-link/guardian-link.store";
import { clearParentPrepForGuardian } from "@/backend/features/parent/parent-daily-prep.store";
import { clearEmpathyGuidesForGuardian } from "@/backend/features/parent/parent-empathy-guide.store";

/**
 * Everything collected from or about a child, in every store — used for account
 * deletion and when a legal guardian withdraws consent (개인정보 보호법: 동의 철회 시
 * 지체 없이 파기).
 *
 * Kept on purpose: the login account, the consent state and consent records
 * (proof of what was agreed and when), and the guardian link, so the same
 * guardian can consent again. Guardian-side summaries made from this child's
 * data (daily prep, empathy guides) are removed for every linked guardian.
 */
export async function eraseChildCollectedData(childUserId: string): Promise<void> {
  // Illustration ids live in the sealed tale, so remove their blobs first.
  await clearStorybookIllustrations(childUserId);
  const scheduleIds = await clearScheduleForChild(childUserId);

  await Promise.all([
    clearPersonaForUser(childUserId),
    deleteAvatarImage(childUserId),
    clearConversationForUser(childUserId),
    clearWalletForUser(childUserId),
    clearGardenForUser(childUserId),
    clearAdventurePacksForUser(childUserId),
    clearMemoryEventsForUser(childUserId),
    clearWishTreeForUser(childUserId),
    clearDiaryForUser(childUserId),
    clearPhotosForUser(childUserId),
    clearDischargeTale(childUserId),
    clearStorybookParentLetter(childUserId),
    clearMemoryLetters(childUserId),
    clearEmotionForUser(childUserId),
    clearBondForUser(childUserId),
    clearCoarseLocationForUser(childUserId),
    clearSafetySignalsForUser(childUserId),
    clearSafetyAlertsForUser(childUserId),
    clearSharingForUser(childUserId),
    clearConcernRequestsForUser(childUserId),
    clearKbSummariesForChild(childUserId),
    ...scheduleIds.map((id) => removeScheduleImage(id)),
  ]);

  const guardianIds = await listGuardianUserIds();
  const linked = (
    await Promise.all(
      guardianIds.map(async (g) => ((await getLinkForGuardian(g))?.childUserId === childUserId ? g : null))
    )
  ).filter((g): g is string => Boolean(g));
  await Promise.all(
    linked.flatMap((g) => [clearParentPrepForGuardian(g), clearEmpathyGuidesForGuardian(g)])
  );
}
