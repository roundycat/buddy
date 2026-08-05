/**
 * Wish Tree — hope wishes (in-hospital / after discharge). Not clinical.
 */

export type WishHorizon = "hospital" | "after_discharge" | "anytime";

export interface WishItem {
  id: string;
  text: string;
  horizon: WishHorizon;
  emoji: string;
  createdAt: string;
}

export interface WishTreeAccount {
  userId: string;
  wishes: WishItem[];
}

export interface WishTreeResponse {
  title: string;
  companionNote: string;
  wishes: WishItem[];
  suggestions: Array<{ emoji: string; text: string; horizon: WishHorizon }>;
}
