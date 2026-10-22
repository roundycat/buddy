/**
 * Beddy 2.0 child-safety signal types.
 *
 * Levels map to what the app must do (see eval/LABELING_GUIDE.md):
 * - urgent   : intent / plan / means / self-harm now → help actions + minimal guardian alert
 * - elevated : wish to die or disappear, self-harm thoughts → help actions + minimal guardian alert
 * - watch    : hopelessness, burden, distressed treatment refusal, loneliness, past risk
 *              → no guardian alert; Beddy checks in; repeated signals ask the child about sharing
 * - protect  : abuse / violence disclosure → never auto-notify the guardian (could be the source);
 *              point to nurse · hospital social work · 112 · 1388
 * - none     : everyday talk, hyperbole, media, education, medical questions
 */

export type SafetyLevel = "none" | "watch" | "elevated" | "urgent" | "protect";

export type SignalCategory =
  | "S1_direct"
  | "S2_indirect"
  | "S3_hopeless_burden"
  | "S4_treatment_refusal"
  | "S5_means"
  | "S6_abuse"
  | "S7_past"
  | "S8_loneliness";

export type Suppressor =
  | "hyperbole"
  | "media"
  | "education"
  | "negation"
  | "third_party"
  | "apology"
  | "benign_place"
  | "task_context"
  | "grief"
  | "medical_object";

export interface SafetyAssessment {
  level: SafetyLevel;
  categories: SignalCategory[];
  /** Rule ids that fired — for audit logs. Never contains message text. */
  rules: string[];
  /** Benign readings that lowered a match. */
  suppressors: Suppressor[];
  /** Someone else's risk was reported (friend, character, news). */
  thirdParty: boolean;
  /** Earlier messages in the same conversation raised the level. */
  contextRaised: boolean;
  /** Abuse disclosure seen — guardian must not be auto-notified. */
  abuse: boolean;
  /** Soft risk words with no clear reading — worth a second (LLM) look. */
  ambiguous: boolean;
}

export interface SafetyInput {
  text: string;
  /** Up to 3 earlier child messages from the same conversation, oldest first. */
  context?: string[];
}

export const LEVEL_RANK: Record<Exclude<SafetyLevel, "protect">, number> = {
  none: 0,
  watch: 1,
  elevated: 2,
  urgent: 3,
};

/** Levels that notify the guardian (minimal facts only, never chat text). */
export function alertsGuardian(level: SafetyLevel): boolean {
  return level === "urgent" || level === "elevated";
}
