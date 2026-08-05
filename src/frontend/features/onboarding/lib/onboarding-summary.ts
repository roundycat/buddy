import { joinSelections } from "@/frontend/features/onboarding/lib/selections";
import type {
  EnergyLevel,
  InteractionStyle,
} from "@/frontend/features/onboarding/lib/onboarding-options";
import type { OnboardingBuildMode } from "@/frontend/features/onboarding/lib/onboarding-payload";

type SelectionWithOther = {
  values: string[];
  other: string;
};

type SummaryInput = {
  currentYear: number;
  energy: EnergyLevel | null;
  interaction: InteractionStyle | null;
  buildMode: OnboardingBuildMode | null;
  selfAgeOrBirthYear: string;
  ageOrBirthYear: string;
  selfDispositions: string[];
  selfStrengths: string[];
  selfWeaknesses: string[];
  charDispositions: string[];
  charStrengths: string[];
  charWeaknesses: string[];
  selfStress: SelectionWithOther;
  selfHobbies: SelectionWithOther;
  selfFavoriteHobby: SelectionWithOther;
  selfMainActivity: SelectionWithOther;
  selfFood: SelectionWithOther;
  stress: SelectionWithOther;
  hobbies: SelectionWithOther;
  favoriteHobby: SelectionWithOther;
  mainActivity: SelectionWithOther;
  food: SelectionWithOther;
  energyOptions: Array<{ id: EnergyLevel; label: string }>;
  interactionOptions: Array<{ id: InteractionStyle; label: string }>;
};

export function buildOnboardingSummary(input: SummaryInput) {
  const energyLabel =
    input.energyOptions.find((option) => option.id === input.energy)?.label ?? "";
  const interactionLabel =
    input.interactionOptions.find((option) => option.id === input.interaction)
      ?.label ?? "";
  const modeLabel =
    input.buildMode === "mirror"
      ? "나와 똑같이 만들기"
      : input.buildMode === "custom"
        ? "직접 설정하기"
        : "";

  const selfDispositionSummary = input.selfDispositions.join(", ");
  const selfStrengthSummary = input.selfStrengths.join(", ");
  const selfWeaknessSummary = input.selfWeaknesses.join(", ");

  const charDispositionSummary =
    input.buildMode === "mirror"
      ? selfDispositionSummary
      : input.charDispositions.join(", ");
  const charStrengthSummary =
    input.buildMode === "mirror"
      ? selfStrengthSummary
      : input.charStrengths.join(", ");
  const charWeaknessSummary =
    input.buildMode === "mirror"
      ? selfWeaknessSummary
      : input.charWeaknesses.join(", ");

  const birthSummary = input.ageOrBirthYear
    ? `${input.ageOrBirthYear}년 · 만 ${input.currentYear - Number(input.ageOrBirthYear)}세`
    : "";
  const selfBirthSummary = input.selfAgeOrBirthYear
    ? `${input.selfAgeOrBirthYear}년 · 만 ${input.currentYear - Number(input.selfAgeOrBirthYear)}세`
    : "";

  const selfStressSummary = joinSelections(input.selfStress.values, input.selfStress.other);
  const selfHobbySummary = joinSelections(
    input.selfHobbies.values,
    input.selfHobbies.other
  );
  const selfFavoriteHobbySummary = joinSelections(
    input.selfFavoriteHobby.values,
    input.selfFavoriteHobby.other
  );
  const selfMainActivitySummary = joinSelections(
    input.selfMainActivity.values,
    input.selfMainActivity.other
  );
  const selfFoodSummary = joinSelections(input.selfFood.values, input.selfFood.other);

  const stressSummary =
    input.buildMode === "mirror"
      ? selfStressSummary
      : joinSelections(input.stress.values, input.stress.other);
  const hobbySummary =
    input.buildMode === "mirror"
      ? selfHobbySummary
      : joinSelections(input.hobbies.values, input.hobbies.other);
  const favoriteHobbySummary =
    input.buildMode === "mirror"
      ? selfFavoriteHobbySummary
      : joinSelections(input.favoriteHobby.values, input.favoriteHobby.other);
  const mainActivitySummary =
    input.buildMode === "mirror"
      ? selfMainActivitySummary
      : joinSelections(input.mainActivity.values, input.mainActivity.other);
  const foodSummary =
    input.buildMode === "mirror"
      ? selfFoodSummary
      : joinSelections(input.food.values, input.food.other);

  return {
    energyLabel,
    interactionLabel,
    modeLabel,
    selfDispositionSummary,
    selfStrengthSummary,
    selfWeaknessSummary,
    charDispositionSummary,
    charStrengthSummary,
    charWeaknessSummary,
    birthSummary,
    selfBirthSummary,
    selfStressSummary,
    selfHobbySummary,
    selfFavoriteHobbySummary,
    selfMainActivitySummary,
    selfFoodSummary,
    stressSummary,
    hobbySummary,
    favoriteHobbySummary,
    mainActivitySummary,
    foodSummary,
  };
}
