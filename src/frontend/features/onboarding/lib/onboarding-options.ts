export type EnergyLevel = "low" | "medium" | "high";

export type InteractionStyle =
  | "listen"
  | "chat"
  | "motivate"
  | "play"
  | "quiet"
  | "story";

/** Steps 0–7: survey; step 8: avatar pick after generate */
export const TOTAL_STEPS = 9;
export const AVATAR_PICK_STEP = 8;

export const ENERGY_OPTIONS: Array<{
  id: EnergyLevel;
  label: string;
  hint: string;
}> = [
  { id: "low", label: "낮음", hint: "힘이 거의 없어요" },
  { id: "medium", label: "보통", hint: "그럭저럭 괜찮아요" },
  { id: "high", label: "높음", hint: "비교적 또렷해요" },
];

export const INTERACTION_OPTIONS: Array<{
  id: InteractionStyle;
  label: string;
  hint: string;
}> = [
  { id: "listen", label: "👂 그냥 들어줘", hint: "내 말을 편하게 들어줘요" },
  {
    id: "chat",
    label: "💬 같이 얘기해 줘",
    hint: "심심할 때 같이 수다 떨어요",
  },
  { id: "motivate", label: "📣 응원해 줘", hint: "힘나는 말을 해줘요" },
  {
    id: "play",
    label: "🎲 같이 놀아 줘",
    hint: "퀴즈나 상상 놀이를 해요",
  },
  {
    id: "quiet",
    label: "🫶 옆에 있어 줘",
    hint: "말이 없어도 같이 있어 줘요",
  },
  {
    id: "story",
    label: "📖 이야기해 줘",
    hint: "짧은 이야기를 들려줘요",
  },
];

export {
  DISPOSITION_OPTIONS,
  STRENGTH_OPTIONS,
  WEAKNESS_OPTIONS,
  STRESS_RELIEF_OPTIONS,
  HOBBY_OPTIONS,
  FAVORITE_HOBBY_OPTIONS,
  MAIN_ACTIVITY_OPTIONS,
  FOOD_OPTIONS,
} from "@/shared/onboarding/profile-options";

export const REGION_OPTIONS = [
  "강원",
  "경기",
  "경남",
  "경북",
  "광주",
  "대구",
  "대전",
  "부산",
  "서울",
  "세종",
  "울산",
  "인천",
  "전남",
  "전북",
  "제주",
  "충남",
  "충북",
] as const;

export const CURRENT_YEAR = new Date().getFullYear();
const MAX_AGE = 30;
export const BIRTH_YEARS = Array.from(
  { length: MAX_AGE + 1 },
  (_, i) => CURRENT_YEAR - i
);
