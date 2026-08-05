import { joinSelections } from "@/frontend/features/onboarding/lib/selections";
import type {
  EnergyLevel,
  InteractionStyle,
} from "@/frontend/features/onboarding/lib/onboarding-options";

type PreferenceSelection = {
  values: string[];
  other: string;
};

export type OnboardingBuildMode = "mirror" | "custom";

export type OnboardingPayloadInput = {
  buildMode: OnboardingBuildMode;
  selfName: string;
  selfAgeOrBirthYear: string;
  selfRegion: string;
  selfDispositions: string[];
  selfStrengths: string[];
  selfWeaknesses: string[];
  selfStressRelief: PreferenceSelection;
  selfHobbies: PreferenceSelection;
  selfFavoriteHobby: PreferenceSelection;
  selfMainActivity: PreferenceSelection;
  selfFavoriteFood: PreferenceSelection;
  nickname: string;
  ageOrBirthYear: string;
  region: string;
  charDispositions: string[];
  charStrengths: string[];
  charWeaknesses: string[];
  stressRelief: PreferenceSelection;
  hobbies: PreferenceSelection;
  favoriteHobby: PreferenceSelection;
  mainActivity: PreferenceSelection;
  favoriteFood: PreferenceSelection;
  energy: EnergyLevel;
  interaction: InteractionStyle;
};

export function buildPersonaGeneratePayload(input: OnboardingPayloadInput) {
  const selfDisposition = input.selfDispositions.join(", ");
  const selfSW = [...input.selfStrengths, ...input.selfWeaknesses].join(" / ");

  const characterDisposition =
    input.buildMode === "mirror"
      ? selfDisposition
      : input.charDispositions.join(", ");
  const characterSW =
    input.buildMode === "mirror"
      ? selfSW
      : [...input.charStrengths, ...input.charWeaknesses].join(" / ");
  const characterStress =
    input.buildMode === "mirror"
      ? joinSelections(input.selfStressRelief.values, input.selfStressRelief.other)
      : joinSelections(input.stressRelief.values, input.stressRelief.other);
  const characterHobbies =
    input.buildMode === "mirror"
      ? joinSelections(input.selfHobbies.values, input.selfHobbies.other)
      : joinSelections(input.hobbies.values, input.hobbies.other);
  const characterFavoriteHobby =
    input.buildMode === "mirror"
      ? joinSelections(input.selfFavoriteHobby.values, input.selfFavoriteHobby.other)
      : joinSelections(input.favoriteHobby.values, input.favoriteHobby.other);
  const characterMainActivity =
    input.buildMode === "mirror"
      ? joinSelections(input.selfMainActivity.values, input.selfMainActivity.other)
      : joinSelections(input.mainActivity.values, input.mainActivity.other);
  const characterFood =
    input.buildMode === "mirror"
      ? joinSelections(input.selfFavoriteFood.values, input.selfFavoriteFood.other)
      : joinSelections(input.favoriteFood.values, input.favoriteFood.other);

  return {
    mode: input.buildMode,
    self: {
      nickname: input.selfName.trim(),
      ageOrBirthYear: input.selfAgeOrBirthYear,
      region: input.selfRegion,
      disposition: selfDisposition,
      strengthsWeaknesses: selfSW,
      stressRelief: joinSelections(
        input.selfStressRelief.values,
        input.selfStressRelief.other
      ),
      hobbies: joinSelections(input.selfHobbies.values, input.selfHobbies.other),
      favoriteHobby: joinSelections(
        input.selfFavoriteHobby.values,
        input.selfFavoriteHobby.other
      ),
      mainActivity: joinSelections(
        input.selfMainActivity.values,
        input.selfMainActivity.other
      ),
      favoriteFood: joinSelections(
        input.selfFavoriteFood.values,
        input.selfFavoriteFood.other
      ),
    },
    character: {
      nickname: input.nickname,
      ageOrBirthYear: input.ageOrBirthYear,
      region: input.region,
      disposition: characterDisposition,
      strengthsWeaknesses: characterSW,
      stressRelief: characterStress,
      hobbies: characterHobbies,
      favoriteHobby: characterFavoriteHobby,
      mainActivity: characterMainActivity,
      favoriteFood: characterFood,
    },
    energy: input.energy,
    interaction: input.interaction,
  };
}
