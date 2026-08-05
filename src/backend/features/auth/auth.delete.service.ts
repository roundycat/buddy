import { clearPersonaForUser } from "@/backend/features/persona/persona.store";
import { deleteAvatarImage } from "@/backend/features/persona/avatar.store";
import { clearConversationForUser } from "@/backend/features/conversation/conversation.store";
import { clearWalletForUser } from "@/backend/features/wallet/wallet.store";
import { clearGardenForUser } from "@/backend/features/emotion-garden/emotion-garden.store";
import { clearAdventurePacksForUser } from "@/backend/features/adventure-quest/adventure-quest.store";
import { clearMemoryEventsForUser } from "@/backend/features/memory-timeline/memory-timeline.store";
import { clearWishTreeForUser } from "@/backend/features/wish-tree/wish-tree.store";
import { clearGuardianDataForUser } from "@/backend/features/guardian-link/guardian-link.store";
import { env } from "@/backend/shared/config/env";
import { isAuroraConfigured } from "@/backend/shared/db/postgres";
import type { AuthUser } from "./auth.types";
import { deleteUserById } from "./auth.users.repo";

/**
 * Wipe app data + Aurora user row for account deletion.
 */
export async function deleteAccount(user: AuthUser): Promise<void> {
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
  ]);

  const preferAurora =
    env.authProvider === "aurora" ||
    (env.authProvider === "auto" && isAuroraConfigured());

  if (preferAurora && isAuroraConfigured()) {
    await deleteUserById(user.id);
  }
}
