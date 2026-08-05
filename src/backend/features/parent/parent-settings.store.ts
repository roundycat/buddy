import { createMapStore } from "@/backend/shared/persist/map-store";

export interface ParentSettings {
  guardianUserId: string;
  notifications: {
    dailyDigest: boolean;
    careTips: boolean;
  };
  privacy: {
    shareEmotionTrends: boolean;
    shareAdventures: boolean;
    shareMemoryHighlights: boolean;
  };
  updatedAt: string;
}

const store = createMapStore<ParentSettings>("parent-settings.json", {
  userIdKey: "guardianUserId",
});

const defaults = (guardianUserId: string): ParentSettings => ({
  guardianUserId,
  notifications: { dailyDigest: true, careTips: true },
  privacy: {
    shareEmotionTrends: true,
    shareAdventures: true,
    shareMemoryHighlights: true,
  },
  updatedAt: new Date().toISOString(),
});

export async function getParentSettings(
  guardianUserId: string
): Promise<ParentSettings> {
  const stored = await store.get(guardianUserId);
  if (!stored) return defaults(guardianUserId);
  const base = defaults(guardianUserId);
  return {
    ...base,
    ...stored,
    guardianUserId,
    notifications: {
      ...base.notifications,
      ...stored.notifications,
    },
    privacy: {
      ...base.privacy,
      ...stored.privacy,
    },
  };
}

export async function saveParentSettings(
  settings: ParentSettings
): Promise<ParentSettings> {
  return store.set(settings.guardianUserId, {
    ...settings,
    updatedAt: new Date().toISOString(),
  });
}
