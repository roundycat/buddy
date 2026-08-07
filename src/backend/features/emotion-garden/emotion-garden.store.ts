import { createMapStore } from "@/backend/shared/persist/map-store";
import type {
  EmotionGardenAccount,
  GardenFlower,
} from "./emotion-garden.types";

const store = createMapStore<EmotionGardenAccount>("emotion-gardens.json");

function emptyGarden(userId: string): EmotionGardenAccount {
  return { userId, flowers: [], storybookSealed: false };
}

/**
 * Convert time-based / instant-bloom records into the day-arc shape.
 * Legacy blooms stay fully bloomed so returning children keep their garden.
 */
function migrateFlower(flower: GardenFlower): GardenFlower {
  const plantedAt = flower.plantedAt ?? `${flower.plantedOn}T09:00:00.000Z`;

  if (Array.isArray(flower.waterings)) {
    return { ...flower, plantedAt };
  }

  // Instant-bloom era or time-based era that already reached bloom.
  const wasBloomed =
    flower.stage === "bloom" ||
    Boolean(flower.bloomedAt) ||
    (typeof flower.growthMs === "number" && flower.growthMs >= 9 * 60 * 60 * 1000) ||
    (!flower.stage && !flower.growthMs);

  if (wasBloomed) {
    return {
      ...flower,
      plantedAt,
      waterings: flower.waterings ?? [
        { at: plantedAt, mood: flower.mood },
        { at: plantedAt, mood: flower.mood },
        { at: plantedAt, mood: flower.mood },
      ],
      bloomedAt: flower.bloomedAt ?? plantedAt,
      stage: "bloom",
    };
  }

  // Mid-growth time-based plant: approximate waterings from careCount.
  const cares = Math.max(0, flower.careCount ?? 0);
  const waterings =
    flower.moodLog?.map((m) => ({ at: m.at, mood: m.mood })).slice(1) ??
    Array.from({ length: Math.max(0, cares - 1) }, (_, i) => ({
      at: plantedAt,
      mood: flower.mood,
      _i: i,
    })).map(({ at, mood }) => ({ at, mood }));

  return {
    ...flower,
    plantedAt,
    waterings,
  };
}

function needsMigration(flower: GardenFlower): boolean {
  return !Array.isArray(flower.waterings);
}

export async function getGardenAccount(
  userId: string
): Promise<EmotionGardenAccount> {
  const existing = await store.get(userId);
  if (!existing) return store.set(userId, emptyGarden(userId));

  const stale = existing.flowers.filter(needsMigration);
  if (stale.length === 0) {
    // Drop obsolete account fields without rewriting flowers.
    if (
      "visitorCollectedOn" in existing ||
      "clockOffsetMs" in existing
    ) {
      const cleaned: EmotionGardenAccount = {
        userId: existing.userId,
        flowers: existing.flowers,
        storybookSealed: existing.storybookSealed,
        sealedAt: existing.sealedAt,
      };
      return store.set(userId, cleaned);
    }
    return existing;
  }

  const migrated: EmotionGardenAccount = {
    userId: existing.userId,
    flowers: existing.flowers.map(migrateFlower),
    storybookSealed: existing.storybookSealed,
    sealedAt: existing.sealedAt,
  };
  return store.set(userId, migrated);
}

export async function saveGardenAccount(
  account: EmotionGardenAccount
): Promise<EmotionGardenAccount> {
  return store.set(account.userId, {
    userId: account.userId,
    flowers: account.flowers,
    storybookSealed: account.storybookSealed,
    sealedAt: account.sealedAt,
  });
}

export async function clearGardenForUser(userId: string) {
  await store.delete(userId);
}
