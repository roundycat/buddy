/**
 * Client-safe catalog + DTO surface.
 * UI imports from here — not `@/backend/*`.
 * Canonical data lives in `@/shared/emotion-garden` and `@/shared/wish-tree`.
 */

export {
  FLOWER_CATALOG,
  MOOD_OPTIONS,
  ALL_MOOD_IDS,
  isMoodId,
  flowerForMood,
  type FlowerSpecies,
} from "@/shared/emotion-garden/flowers";

export type {
  MoodId,
  MoodOption,
  GrowthStage,
  EmotionSeedSuggestion,
  GardenPlantView,
  FlowerMemoryCard,
  EmotionGardenResponse,
  GardenSky,
  SkyPhase,
} from "@/shared/emotion-garden/types";

export {
  LEAF_CATALOG,
  WISH_KIND_OPTIONS,
  ALL_WISH_KINDS,
  isWishKind,
  leafForKind,
  guessWishKind,
  type LeafSpecies,
} from "@/shared/wish-tree/leaves";

export type {
  WishKind,
  WishKindOption,
  LeafShape,
  LeafMemoryCard,
  WishHorizon,
  WishLeafView,
  WishTreeResponse,
  WishInspiration,
  TreeSeason,
  TreeSky,
  TreeStage,
} from "@/shared/wish-tree/types";
