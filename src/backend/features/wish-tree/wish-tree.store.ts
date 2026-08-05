import { createMapStore } from "@/backend/shared/persist/map-store";
import type { WishTreeAccount, WishItem } from "./wish-tree.types";

const store = createMapStore<WishTreeAccount>("wish-trees.json");

function emptyTree(userId: string): WishTreeAccount {
  return { userId, wishes: [] };
}

export async function getWishTreeAccount(
  userId: string
): Promise<WishTreeAccount> {
  const existing = await store.get(userId);
  if (existing) return existing;
  return store.set(userId, emptyTree(userId));
}

export async function saveWishTreeAccount(
  account: WishTreeAccount
): Promise<WishTreeAccount> {
  return store.set(account.userId, account);
}

export async function listWishes(userId: string): Promise<WishItem[]> {
  return (await getWishTreeAccount(userId)).wishes;
}

export async function clearWishTreeForUser(userId: string) {
  await store.delete(userId);
}
