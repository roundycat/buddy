import "server-only";
import { maybeComposeDayStory } from "@/backend/features/adventure-quest/adventure-story.service";

/**
 * Nightly Story Updates — compose day story when missions are done
 * so Parent / Storybook do not trigger Bedrock on page load.
 */
export async function updateStoriesForUser(
  userId: string
): Promise<{ ok: boolean; composed: boolean }> {
  try {
    const story = await maybeComposeDayStory(userId);
    return { ok: true, composed: Boolean(story) };
  } catch (error) {
    console.warn("[batch.story] update failed", userId, error);
    return { ok: false, composed: false };
  }
}
