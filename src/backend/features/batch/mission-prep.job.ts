import "server-only";
import { todayKey } from "@/backend/shared/time/date";
import {
  getAdventurePack,
} from "@/backend/features/adventure-quest/adventure-quest.store";
import { prepareAdventurePackForDate } from "@/backend/ai/agent/mission-agent";

/**
 * Job 2 — Pre-generate today's adventure missions (AI Agent).
 */
export async function prepareMissionsForUser(
  userId: string,
  dateKey = todayKey()
): Promise<{ userId: string; ok: boolean; created: boolean }> {
  try {
    const existing = await getAdventurePack(userId, dateKey);
    if (existing?.quests?.length) {
      return { userId, ok: true, created: false };
    }
    await prepareAdventurePackForDate(userId, dateKey);
    // prepareAdventurePackForDate already persists
    return { userId, ok: true, created: true };
  } catch (error) {
    console.error("[batch.missions]", userId, error);
    return { userId, ok: false, created: false };
  }
}
