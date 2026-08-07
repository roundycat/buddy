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
  kind?:
    | "adventure"
    | "wish"
    | "garden"
    | "drawing"
    | "photo"
    | "reflection"
    | "opening"
    | "parent_letter"
    | "ending"
    | "goodbye"
    | "epilogue";
  photoUrl?: string;
  drawingUrl?: string;
  chapterNumber?: number;
  /** Small, truthful memory note shown beneath the rewritten story. */
  memory?: {
    label: string;
    detail?: string;
    date?: string;
    emotionEmoji?: string;
    source:
      | "conversation"
      | "emotion"
      | "adventure"
      | "photo"
      | "drawing"
      | "wish"
      | "family"
      | "beddy";
  };
  /** Procedural watercolor art direction; never a clinical illustration. */
  illustration?: {
    motif:
      | "castle"
      | "forest"
      | "garden"
      | "tree"
      | "window"
      | "stars"
      | "sunrise"
      | "home"
      | "friends";
    palette: "sage" | "rose" | "sky" | "amber" | "violet";
    alt: string;
    imageUrl?: string;
    imageStatus?: "pending" | "ready" | "failed";
  };
  animation?: "sparkles" | "leaves" | "butterflies" | "sunlight" | "fireflies";
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
  favoriteTheme?: string;
  accentColor?: string;
}

export interface ParentLetterPage {
  title: string;
  body: string;
  bodyHtml?: string;
  signature: string;
  date: string;
  photoUrl?: string;
  handwriting: boolean;
  /** YYYY-MM-DD — letter content unlocks on this local calendar day. */
  dischargeDate?: string;
  /** ISO timestamp when the parent hit send — letter is already transmitted. */
  sentAt?: string;
  /**
   * True while today &lt; dischargeDate. Body/photo are redacted for the child
   * until unlock; the envelope page still appears in the book.
   */
  locked?: boolean;
  /** Envelope UI until the child opens it (only when unlocked). */
  surprise?: boolean;
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
  /** Authored only by a linked guardian; Storybook AI never writes this page. */
  parentLetter: ParentLetterPage | null;
  epilogue: StorybookPage | null;
  goodbye: StorybookPage | null;
  readingProgress: {
    pageIndex: number;
    completed: boolean;
    updatedAt?: string;
  };
}
