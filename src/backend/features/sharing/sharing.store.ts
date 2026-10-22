import "server-only";
import { createMapStore } from "@/backend/shared/persist/map-store";
import type { ChildSharingPrefs } from "./sharing.types";

/** Child-chosen sharing categories (key: childUserId). */
const store = createMapStore<ChildSharingPrefs>("child-sharing.json", {
  userIdKey: "childUserId",
});

export async function getStoredSharingPrefs(
  childUserId: string
): Promise<ChildSharingPrefs | null> {
  return (await store.get(childUserId)) ?? null;
}

export async function saveSharingPrefs(
  prefs: ChildSharingPrefs
): Promise<ChildSharingPrefs> {
  return store.set(prefs.childUserId, prefs);
}

export async function clearSharingForUser(userId: string) {
  await store.delete(userId);
}
