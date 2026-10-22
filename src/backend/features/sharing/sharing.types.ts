/**
 * Child-controlled sharing (아동 선택 기반 공유) — shared types.
 * Pure module: safe for client components, tests and server code alike.
 */

/** Categories the child decides to share with linked guardians. */
export const SHARE_CATEGORIES = [
  "mood",
  "adventures",
  "memoryHighlights",
  "media",
] as const;

export type ShareCategory = (typeof SHARE_CATEGORIES)[number];

export type ShareChoice = "share" | "private";

export type ShareChoices = Record<ShareCategory, ShareChoice>;

/** Defaults when the child has not chosen yet. Photos/drawings stay private. */
export const DEFAULT_SHARE_CHOICES: Readonly<ShareChoices> = Object.freeze({
  mood: "share",
  adventures: "share",
  memoryHighlights: "share",
  media: "private",
});

export interface ChildSharingPrefs {
  childUserId: string;
  choices: Partial<ShareChoices>;
  updatedAt: string;
}

/** What a guardian sees for one category. */
export type GuardianVisibility = "shown" | "child_private" | "guardian_off";

export type GuardianVisibilityMap = Record<ShareCategory, GuardianVisibility>;

export function isShareCategory(value: unknown): value is ShareCategory {
  return (
    typeof value === "string" &&
    (SHARE_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isShareChoice(value: unknown): value is ShareChoice {
  return value === "share" || value === "private";
}

/** Fill missing categories with defaults (stored rows may be partial). */
export function withDefaultShareChoices(
  stored?: Partial<ShareChoices> | null
): ShareChoices {
  const next = { ...DEFAULT_SHARE_CHOICES };
  for (const category of SHARE_CATEGORIES) {
    const value = stored?.[category];
    if (isShareChoice(value)) next[category] = value;
  }
  return next;
}
