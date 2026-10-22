/**
 * Onboarding: user's self traits + secret-friend character.
 * Mode mirror = copy self survey into character; custom = configure separately.
 */

export type EnergyLevel = "low" | "medium" | "high";
export type InteractionStyle =
  | "listen"
  | "chat"
  | "motivate"
  | "play"
  | "quiet"
  | "story";
export type PersonaBuildMode = "mirror" | "custom";

/** Shared survey fields (basics + personality + lifestyle) */
export interface SurveyProfile {
  nickname: string;
  ageOrBirthYear: string;
  region: string;
  disposition: string;
  mbti: string;
  strengthsWeaknesses: string;
  stressRelief: string;
  hobbies: string;
  favoriteHobby: string;
  mainActivity: string;
  favoriteFood: string;
}

/** Who the human is — same survey shape as the secret friend */
export type SelfProfile = SurveyProfile;

/** Secret-friend character seed */
export type CharacterProfile = SurveyProfile;

/** @deprecated alias — character seed */
export type UserProfile = CharacterProfile;

export interface PersonaPreferences {
  mode: PersonaBuildMode;
  self: SelfProfile;
  character: CharacterProfile;
  energy: EnergyLevel;
  interaction: InteractionStyle;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  greeting: string;
  tone: string;
  companionMessage: string;
  characterSheet?: string;
  /** Relative URL served by /api/persona/avatar (crayon portrait) */
  avatarUrl?: string;
  /**
   * Whether an image model drew the active portrait. False for the bundled
   * crayon drawings used when this deployment has no image model — those do
   * not get the "AI로 그렸어요" label. Unset for portraits made before this was
   * tracked (shown as AI-made, as before).
   */
  avatarAiMade?: boolean;
  /** The same, per candidate drawn for the child to pick from. */
  avatarChoiceAiMade?: Record<string, boolean>;
  avatarPrompt?: string;
  prompt?: string;
  /**
   * Hospital-journey day shown in the waiting room ("N일째").
   * Prefer computing from `journeyStartedAt` — do not treat a frozen 1 as truth.
   */
  dayCount?: number;
  /** ISO timestamp when the child finished onboarding / journey began */
  journeyStartedAt?: string;
  callName?: string;
  energy?: EnergyLevel;
  interaction?: InteractionStyle;
  buildMode?: PersonaBuildMode;
  self?: SelfProfile;
  profile?: CharacterProfile;
  setupCompleted?: boolean;
}

export interface GetPersonaResponse {
  persona: Persona;
  setupCompleted: boolean;
}

export interface GeneratePersonaResponse {
  persona: Persona;
  setupCompleted: true;
  /** Two crayon avatar candidates for the user to pick */
  avatarChoices?: Array<{
    id: string;
    url: string;
  }>;
}
