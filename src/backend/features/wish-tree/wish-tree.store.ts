import { createMapStore } from "@/backend/shared/persist/map-store";
import { guessWishKind, isWishKind } from "./wish-tree.leaves";
import type { WishTreeAccount, WishItem } from "./wish-tree.types";

const store = createMapStore<WishTreeAccount>("wish-trees.json");

function emptyTree(userId: string): WishTreeAccount {
  return { userId, wishes: [] };
}

/**
 * Wishes hung before the leaf redesign have no `kind`.
 * Infer one from the child's own words so every old wish still gets a real leaf.
 */
function withKinds(account: WishTreeAccount): {
  account: WishTreeAccount;
  changed: boolean;
} {
  let changed = false;
  const wishes = account.wishes.map((wish) => {
    if (isWishKind(wish.kind)) return wish;
    changed = true;
    return { ...wish, kind: guessWishKind(wish.text) } satisfies WishItem;
  });
  return { account: { ...account, wishes }, changed };
}

export async function getWishTreeAccount(
  userId: string
): Promise<WishTreeAccount> {
  const existing = await store.get(userId);
  if (!existing) return store.set(userId, emptyTree(userId));

  const { account, changed } = withKinds(existing);
  if (!changed) return existing;
  return store.set(userId, account);
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
