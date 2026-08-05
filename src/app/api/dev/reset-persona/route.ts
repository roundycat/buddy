import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  verifySessionToken,
} from "@/backend/features/auth/auth.service";
import { clearPersonaForUser } from "@/backend/features/persona/persona.store";
import { clearConversationForUser } from "@/backend/features/conversation/conversation.store";
import { clearEmotionForUser } from "@/backend/features/emotion-analysis/emotion.store";
import { clearWalletForUser } from "@/backend/features/wallet/wallet.store";
import { clearGardenForUser } from "@/backend/features/emotion-garden/emotion-garden.store";
import { clearAdventurePacksForUser } from "@/backend/features/adventure-quest/adventure-quest.store";
import { clearMemoryEventsForUser } from "@/backend/features/memory-timeline/memory-timeline.store";
import { clearWishTreeForUser } from "@/backend/features/wish-tree/wish-tree.store";
import { PERSONA_READY_COOKIE } from "@/backend/features/persona/persona.constants";

/**
 * TEMP / DEV: clear persona so onboarding can run again.
 */
export async function POST() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  const user = token ? await verifySessionToken(token) : null;

  if (user) {
    await Promise.all([
      clearPersonaForUser(user.id),
      clearConversationForUser(user.id),
      clearEmotionForUser(user.id),
      clearWalletForUser(user.id),
      clearGardenForUser(user.id),
      clearAdventurePacksForUser(user.id),
      clearMemoryEventsForUser(user.id),
      clearWishTreeForUser(user.id),
    ]);
  }

  const response = NextResponse.json({ ok: true, reset: "persona" });
  response.cookies.set(PERSONA_READY_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
