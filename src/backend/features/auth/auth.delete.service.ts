import { clearPersonaForUser } from "@/backend/features/persona/persona.store";
import { deleteAvatarImage } from "@/backend/features/persona/avatar.store";
import { clearConversationForUser } from "@/backend/features/conversation/conversation.store";
import { clearWalletForUser } from "@/backend/features/wallet/wallet.store";
import { clearGardenForUser } from "@/backend/features/emotion-garden/emotion-garden.store";
import { clearAdventurePacksForUser } from "@/backend/features/adventure-quest/adventure-quest.store";
import { clearMemoryEventsForUser } from "@/backend/features/memory-timeline/memory-timeline.store";
import { clearWishTreeForUser } from "@/backend/features/wish-tree/wish-tree.store";
import { clearGuardianDataForUser } from "@/backend/features/guardian-link/guardian-link.store";
import { clearDiaryForUser } from "@/backend/features/picture-diary/picture-diary.store";
import { clearDischargeTale } from "@/backend/features/growth-storybook/growth-storybook.store";
import { clearStorybookParentLetter } from "@/backend/features/growth-storybook/storybook-parent-letter.store";
import { clearStorybookIllustrations } from "@/backend/features/growth-storybook/storybook-illustration.service";
import { clearMemoryLetters } from "@/backend/features/memory-post/memory-post.store";
import { clearConsentForUser } from "@/backend/features/consent/consent.store";
import { clearSharingForUser } from "@/backend/features/sharing/sharing.store";
import { clearConcernRequestsForUser } from "@/backend/features/sharing/concern-request.store";
import type { AuthUser } from "./auth.types";
import { deleteDynamoUser } from "./auth.users.dynamo.repo";

/**
 * Wipe app data + auth user row for account deletion.
 */
export async function deleteAccount(user: AuthUser): Promise<void> {
  // Illustration IDs live in the sealed tale, so remove their blobs first.
  await clearStorybookIllustrations(user.id);
  await Promise.all([
    clearPersonaForUser(user.id),
    deleteAvatarImage(user.id),
    clearConversationForUser(user.id),
    clearWalletForUser(user.id),
    clearGardenForUser(user.id),
    clearAdventurePacksForUser(user.id),
    clearMemoryEventsForUser(user.id),
    clearWishTreeForUser(user.id),
    clearGuardianDataForUser(user.id),
    clearDiaryForUser(user.id),
    clearDischargeTale(user.id),
    clearStorybookParentLetter(user.id),
    clearMemoryLetters(user.id),
    clearConsentForUser(user.id),
    clearSharingForUser(user.id),
    clearConcernRequestsForUser(user.id),
  ]);

  await deleteDynamoUser(user.id);
}
