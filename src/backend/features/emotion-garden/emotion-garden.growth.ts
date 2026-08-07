/**
 * Day-arc growth for the emotion garden.
 *
 * seed  --water×1--> sprout --water×2--> bud --adventure OR water×3--> bloom
 *
 * Adventure completion is supplied by the caller (read from the adventure pack).
 * Pure functions only — no wall clock, no wilt, no rewards.
 */

import type { GardenFlower, GrowthStage } from "./emotion-garden.types";

export const STAGE_LABEL: Record<GrowthStage, string> = {
  seed: "씨앗",
  sprout: "새싹",
  bud: "꽃봉오리",
  bloom: "활짝 핀 꽃",
};

/** Waters needed to reach each stage (planting = 0). */
export const WATERS_FOR_SPROUT = 1;
export const WATERS_FOR_BUD = 2;
/** Without an adventure pack, a third watering still lets the flower bloom. */
export const WATERS_FOR_BLOOM_SOLO = 3;

export function waterCount(plant: GardenFlower): number {
  return plant.waterings?.length ?? 0;
}

export function stageForPlant(
  plant: GardenFlower,
  adventureComplete: boolean
): GrowthStage {
  const waters = waterCount(plant);
  if (plant.bloomedAt) return "bloom";
  if (waters >= WATERS_FOR_BLOOM_SOLO) return "bloom";
  if (waters >= WATERS_FOR_BUD && adventureComplete) return "bloom";
  if (waters >= WATERS_FOR_BUD) return "bud";
  if (waters >= WATERS_FOR_SPROUT) return "sprout";
  return "seed";
}

export function growthProgress(
  plant: GardenFlower,
  adventureComplete: boolean
): number {
  const stage = stageForPlant(plant, adventureComplete);
  if (stage === "bloom") return 1;
  if (stage === "bud") return adventureComplete ? 0.9 : 0.66;
  if (stage === "sprout") return 0.33;
  return 0.08;
}

export function canWaterPlant(
  plant: GardenFlower,
  adventureComplete: boolean
): boolean {
  return stageForPlant(plant, adventureComplete) !== "bloom";
}

/** Apply one watering. Returns a new plant; does not decide bloom by itself. */
export function applyWatering(
  plant: GardenFlower,
  atIso: string
): GardenFlower {
  return {
    ...plant,
    waterings: [...(plant.waterings ?? []), { at: atIso, mood: plant.mood }],
  };
}

/**
 * Stamp bloomedAt when the stage first reaches bloom. Safe to call on every
 * read after watering or after adventure completion.
 */
export function sealBloomIfReady(
  plant: GardenFlower,
  adventureComplete: boolean,
  nowIso: string
): GardenFlower {
  const stage = stageForPlant(plant, adventureComplete);
  if (stage !== "bloom") return plant;
  if (plant.bloomedAt) return plant;
  return { ...plant, bloomedAt: nowIso, stage: "bloom" };
}
