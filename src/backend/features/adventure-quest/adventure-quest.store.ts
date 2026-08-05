import { createMapStore } from "@/backend/shared/persist/map-store";
import type { AdventureDayPack } from "./adventure-quest.types";

const store = createMapStore<AdventureDayPack>("adventure-packs.json");

function key(userId: string, date: string) {
  return `${userId}:${date}`;
}

export async function getAdventurePack(
  userId: string,
  date: string
): Promise<AdventureDayPack | null> {
  return (await store.get(key(userId, date))) ?? null;
}

export async function saveAdventurePack(
  pack: AdventureDayPack
): Promise<AdventureDayPack> {
  return store.set(key(pack.userId, pack.date), pack);
}

export async function listAdventurePacksForUser(
  userId: string
): Promise<AdventureDayPack[]> {
  const all = await store.values();
  return all.filter((p) => p.userId === userId);
}

export async function clearAdventurePacksForUser(userId: string) {
  await store.clearByUserId(userId);
}
