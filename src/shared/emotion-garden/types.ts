/**
 * Emotion Garden — grow feelings as flowers across the hospital stay.
 * Plant one emotional seed a day → water → complete today's adventure → bloom.
 * Every feeling becomes a beautiful flower. No scores, no garden rewards.
 */

export type MoodId =
  | "happy"
  | "brave"
  | "hope"
  | "calm"
  | "love"
  | "sleepy"
  | "sad"
  | "lonely"
  | "angry";

export interface MoodOption {
  id: MoodId;
  emoji: string;
  label: string;
}

export type GrowthStage = "seed" | "sprout" | "bud" | "bloom";

/** One watering (mood care) applied to a plant. */
export interface Watering {
  at: string; // ISO
  /** Optional mood chosen while watering; defaults to the plant's seed mood */
  mood?: MoodId;
}

/**
 * A plant in the garden. Kept under the legacy `flowers` name because eight
 * downstream services read this array; growth fields are additive.
 */
export interface GardenFlower {
  id: string;
  mood: MoodId;
  emoji: string;
  /** Hospital day when planted (1-based) */
  dayIndex: number;
  plantedOn: string; // YYYY-MM-DD
  name: string;
  note: string;
  plantedAt: string; // ISO
  /** Waterings after planting (planting itself is not counted) */
  waterings: Watering[];
  bloomedAt?: string;
  /**
   * Legacy fields from the time-based growth model. Kept optional so old
   * records still parse; ignored by the day-arc growth logic.
   */
  stage?: GrowthStage;
  growthMs?: number;
  tickedAt?: string;
  lastCaredAt?: string;
  careCount?: number;
  moodLog?: Array<{ mood: MoodId; at: string }>;
}

export interface EmotionGardenAccount {
  userId: string;
  flowers: GardenFlower[];
  storybookSealed: boolean;
  sealedAt?: string;
}

/** Stored plant plus values derived at read time. */
export interface GardenPlantView extends GardenFlower {
  stage: GrowthStage;
  /** 0–1 toward bloom */
  progress: number;
  stageLabel: string;
  canWater: boolean;
  waterCount: number;
  /** Adventure for that day is fully done (or day story exists) */
  adventureComplete: boolean;
  flowerName: string;
}

export type SkyPhase = "dawn" | "day" | "dusk" | "night";

export interface GardenSky {
  phase: SkyPhase;
  weather: "sunny" | "cloudy" | "rainy";
  weatherLabel: string;
  weatherEmoji: string;
  tempC: number | null;
}

/** Soft AI suggestion for today's seed — child may accept or pick another. */
export interface EmotionSeedSuggestion {
  mood: MoodId;
  flowerName: string;
  emoji: string;
  reason: string;
  source: "llm" | "heuristic" | "none";
}

export interface EmotionGardenResponse {
  title: string;
  companionNote: string;
  dayCount: number;
  todayDate: string;
  todayMood: MoodId | null;
  canPlantToday: boolean;
  moods: MoodOption[];
  flowers: GardenPlantView[];
  /** Visual plot size grows with stay length + blooms */
  plotSlots: number;
  sky: GardenSky;
  bloomedCount: number;
  suggestion: EmotionSeedSuggestion | null;
  storybook: {
    sealed: boolean;
    title: string;
    summary: string;
    flowerCount: number;
    sealedAt?: string;
  };
}

/** Memory card shown when a flower is tapped. */
export interface FlowerMemoryCard {
  flowerId: string;
  plantedOn: string;
  mood: MoodId;
  flowerName: string;
  emotionLabel: string;
  emoji: string;
  note: string;
  stage: GrowthStage;
  adventure: {
    headline: string | null;
    narrative: string | null;
    quests: Array<{ emoji: string; title: string; done: boolean }>;
  };
  photos: Array<{ id: string; url: string; caption?: string }>;
  conversationSummaries: string[];
  reflection: string;
  /** Placeholders for features not yet built */
  drawingAvailable: false;
  voiceAvailable: false;
}
