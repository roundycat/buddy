import type {
  PersonaBuildMode,
  PersonaPreferences,
  SurveyProfile,
} from "./persona.types";

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asMode(value: unknown): PersonaBuildMode {
  return value === "custom" ? "custom" : "mirror";
}

function asSurvey(value: unknown): SurveyProfile {
  const o = (value ?? {}) as Record<string, unknown>;
  return {
    nickname: str(o.nickname),
    ageOrBirthYear: str(o.ageOrBirthYear),
    region: str(o.region),
    disposition: str(o.disposition),
    mbti: str(o.mbti),
    strengthsWeaknesses: str(o.strengthsWeaknesses),
    stressRelief: str(o.stressRelief),
    hobbies: str(o.hobbies),
    favoriteHobby: str(o.favoriteHobby),
    mainActivity: str(o.mainActivity),
    favoriteFood: str(o.favoriteFood),
  };
}

/**
 * Parse generate-persona request body into typed preferences.
 * Keeps Route Handlers thin.
 */
export function parsePersonaPreferencesBody(
  body: unknown
): PersonaPreferences {
  const raw = (body ?? {}) as Record<string, unknown>;
  return {
    mode: asMode(raw.mode),
    self: asSurvey(raw.self),
    character: asSurvey(raw.character),
    energy: raw.energy as PersonaPreferences["energy"],
    interaction: raw.interaction as PersonaPreferences["interaction"],
  };
}
