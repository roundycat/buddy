/**
 * AI Growth Storybook — discharge fairy-tale grown from daily life in Beddy.
 */

export interface StorybookPage {
  id: string;
  pageNumber: number;
  date: string;
  title: string;
  body: string;
  missions: Array<{ emoji: string; title: string }>;
  headline: string;
  kind?: "adventure" | "wish" | "garden" | "opening" | "epilogue";
  photoUrl?: string;
}

export interface WishClosingPage {
  title: string;
  headline: string;
  body: string;
  wishes: Array<{ emoji: string; text: string }>;
}

export interface StorybookCover {
  title: string;
  subtitle: string;
  childName: string;
  companionName: string;
  dedication: string;
}

export interface GrowthStorybookResponse {
  title: string;
  companionNote: string;
  sealed: boolean;
  sealedAt?: string;
  pageCount: number;
  flowerCount: number;
  wishCount: number;
  cover: StorybookCover | null;
  opening: StorybookPage | null;
  pages: StorybookPage[];
  /** Last page of discharge book — hopes remembered on the Wish Tree */
  wishClosing: WishClosingPage | null;
  epilogue: StorybookPage | null;
}
