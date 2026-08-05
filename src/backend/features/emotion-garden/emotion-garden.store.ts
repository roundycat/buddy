import { createMapStore } from "@/backend/shared/persist/map-store";
import type { EmotionGardenAccount } from "./emotion-garden.types";

const store = createMapStore<EmotionGardenAccount>("emotion-gardens.json");

function emptyGarden(userId: string): EmotionGardenAccount {
  return { userId, flowers: [], storybookSealed: false };
}

export async function getGardenAccount(
  userId: string
): Promise<EmotionGardenAccount> {
  const existing = await store.get(userId);
  if (existing) return existing;
  return store.set(userId, emptyGarden(userId));
}

export async function saveGardenAccount(
  account: EmotionGardenAccount
): Promise<EmotionGardenAccount> {
  return store.set(account.userId, account);
}

export async function clearGardenForUser(userId: string) {
  await store.delete(userId);
}
