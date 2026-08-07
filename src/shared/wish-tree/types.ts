/**
 * Wish Tree (마음 나무) — every meaningful wish becomes a leaf on a living tree.
 * Not a reward system, not a game: an emotional memory place. Not clinical.
 */

export type WishHorizon = "hospital" | "after_discharge" | "anytime";

/** The kind of longing behind a wish — drives leaf shape and colour. */
export type WishKind =
  | "play"
  | "meet"
  | "home"
  | "outside"
  | "taste"
  | "heal"
  | "make"
  | "rest";

export type LeafShape =
  | "round"
  | "ginkgo"
  | "heart"
  | "willow"
  | "teardrop"
  | "clover"
  | "star"
  | "oval";

export interface WishKindOption {
  id: WishKind;
  label: string;
  hint: string;
  emoji: string;
}

/**
 * Stored wish. `kind` is optional on disk so leaves written before the
 * redesign still load; the store fills it in on read.
 */
export interface WishItem {
  id: string;
  text: string;
  horizon: WishHorizon;
  emoji: string;
  createdAt: string;
  kind?: WishKind;
}

export interface WishTreeAccount {
  userId: string;
  wishes: WishItem[];
}

/** How big the tree has grown — purely from how many leaves it carries. */
export type TreeStage = "sprout" | "young" | "growing" | "full" | "ancient";

export type TreeSeason = "spring" | "summer" | "autumn" | "winter";

export type SkyPhase = "dawn" | "day" | "dusk" | "night";

export interface TreeSky {
  phase: SkyPhase;
  weather: "sunny" | "cloudy" | "rainy";
  weatherLabel: string;
  weatherEmoji: string;
  tempC: number | null;
}

/**
 * A leaf as the tree draws it.
 * `nx` / `ny` are normalised canopy coordinates in [-1, 1] so the client can
 * scale the canopy as the tree grows without leaves jumping around.
 */
export interface WishLeafView {
  id: string;
  text: string;
  kind: WishKind;
  shape: LeafShape;
  label: string;
  emoji: string;
  horizon: WishHorizon;
  createdAt: string;
  dateKey: string;
  nx: number;
  ny: number;
  /** Degrees, so no two leaves hang exactly alike */
  rotate: number;
  scale: number;
  /** 0 plain · 1 soft · 2 bright — how much memory that day holds */
  glow: 0 | 1 | 2;
}

export interface WishTreeResponse {
  title: string;
  companionNote: string;
  leaves: WishLeafView[];
  kinds: WishKindOption[];
  tree: {
    stage: TreeStage;
    stageLabel: string;
    season: TreeSeason;
    leafCount: number;
    /** Days since the first leaf was hung */
    dayCount: number;
    /** Leaves still needed before the tree grows again, null once fully grown */
    nextStageIn: number | null;
  };
  sky: TreeSky;
  /** Soft starting points when a child does not know what to write */
  suggestions: Array<{ emoji: string; text: string; horizon: WishHorizon }>;
}

/**
 * Starter lines when a child does not know what to write.
 * Only ever a nudge — the child always writes the wish themselves.
 */
export interface WishInspiration {
  lines: Array<{ text: string; kind: WishKind }>;
  source: "llm" | "static";
}

/** Tap a leaf → the memory of the day it was hung. */
export interface LeafMemoryCard {
  leafId: string;
  text: string;
  kind: WishKind;
  shape: LeafShape;
  label: string;
  emoji: string;
  horizon: WishHorizon;
  dateKey: string;
  glow: 0 | 1 | 2;
  adventure: {
    headline: string | null;
    narrative: string | null;
    quests: Array<{ emoji: string; title: string; done: boolean }>;
  };
  photos: Array<{ id: string; url: string; caption?: string }>;
  conversationSummaries: string[];
  /** One warm line from Beddy about that day */
  reflection: string;
  drawingAvailable: boolean;
  voiceAvailable: boolean;
}
