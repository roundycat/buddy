import type {
  EnergyLevel,
  InteractionStyle,
} from "@/frontend/features/onboarding/lib/onboarding-options";
import type { OnboardingBuildMode } from "@/frontend/features/onboarding/lib/onboarding-payload";

type NextAction =
  | { type: "error"; message: string }
  | { type: "go"; step: number }
  | { type: "mirror-and-go"; step: number }
  | { type: "submit" };

type NextActionInput = {
  step: number;
  selfName: string;
  buildMode: OnboardingBuildMode | null;
  nickname: string;
  energy: EnergyLevel | null;
  interaction: InteractionStyle | null;
};

export function getOnboardingNextAction(input: NextActionInput): NextAction {
  if (input.step === 0) {
    if (!input.selfName.trim()) {
      return { type: "error", message: "이름을 입력해 주세요." };
    }
    return { type: "go", step: 1 };
  }
  if (input.step === 1) return { type: "go", step: 2 };
  if (input.step === 2) return { type: "go", step: 3 };
  if (input.step === 3) {
    if (!input.buildMode) {
      return { type: "error", message: "친구를 어떻게 만들지 골라 주세요." };
    }
    if (input.buildMode === "mirror") {
      return { type: "mirror-and-go", step: 4 };
    }
    return { type: "go", step: 4 };
  }
  if (input.step === 4) {
    if (!input.nickname.trim()) {
      return { type: "error", message: "Beddy의 이름을 입력해 주세요." };
    }
    return { type: "go", step: 5 };
  }
  if (input.step === 5) return { type: "go", step: 6 };
  if (input.step === 6) {
    if (!input.energy) return { type: "error", message: "컨디션을 선택해 주세요." };
    if (!input.interaction) {
      return { type: "error", message: "상호작용 방식을 선택해 주세요." };
    }
    return { type: "go", step: 7 };
  }
  return { type: "submit" };
}
