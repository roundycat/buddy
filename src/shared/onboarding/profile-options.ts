/**
 * Chip labels offered in onboarding's self survey. Shared so the server can
 * tell an app-provided label from what a child typed under "기타": only the
 * labels may reach a guardian's screen, never the child's own words.
 */

export const DISPOSITION_OPTIONS = [
  "🤫 말이 적어요",
  "🤔 생각이 많아요",
  "💛 마음이 따뜻해요",
  "🛡️ 조심해요",
  "😄 장난을 좋아해요",
  "🌱 혼자 있는 게 좋아요",
  "🔥 사람들과 노는 게 좋아요",
  "🫧 마음이 여려요",
  "🌟 상상하기를 좋아해요",
] as const;

export const STRENGTH_OPTIONS = [
  "💞 남을 잘 챙겨줘요",
  "👂 이야기를 잘 들어줘요",
  "💪 끝까지 해요",
  "🧠 집중을 잘해요",
  "✨ 새로운 생각을 잘해요",
  "😌 침착해요",
  "🌈 밝게 생각해요",
  "🤝 믿을 수 있어요",
  "🫶 고마움을 잘 말해요",
] as const;

export const WEAKNESS_OPTIONS = [
  "😵 걱정을 오래 해요",
  "🫠 나를 자주 혼내요",
  "⏳ 결정을 늦게 해요",
  "😴 금방 지쳐요",
  "🙈 내 마음을 말하기 어려워요",
  "🌧️ 불안해질 때가 많아요",
  "🧩 같은 생각을 계속해요",
  "📉 나를 작게 봐요",
  "😶 부탁을 잘 못해요",
] as const;

export const STRESS_RELIEF_OPTIONS = [
  "🎧 음악 듣기",
  "🚶 산책",
  "✍️ 일기 쓰기",
  "😴 잠자기",
  "🎮 게임",
  "🎨 그림 그리기",
  "🧘 깊은 호흡",
  "🛁 샤워하기",
  "🍫 간식 먹기",
] as const;

export const HOBBY_OPTIONS = [
  "🎨 그림",
  "🎮 게임",
  "🎬 드라마/영화",
  "📚 독서",
  "🎵 음악",
  "📸 사진",
  "🏃 운동",
  "🍳 요리/베이킹",
  "🧩 퍼즐",
] as const;

export const FAVORITE_HOBBY_OPTIONS = [
  "📱 웹툰 보기",
  "🎧 음악 듣기",
  "🕹️ 게임하기",
  "📺 드라마 보기",
  "🖍️ 그림 그리기",
  "📝 일기 쓰기",
  "🌿 산책하기",
  "💬 수다 떨기",
  "📚 책 읽기",
] as const;

export const MAIN_ACTIVITY_OPTIONS = [
  "📘 학교 과제",
  "🏥 치료 받기",
  "🛌 휴식",
  "💻 온라인 수업",
  "📖 독서",
  "🎭 창작 활동",
  "👨‍👩‍👧 가족과의 시간",
  "📱 친구와 연락",
  "🎵 음악 듣기",
] as const;

export const FOOD_OPTIONS = [
  "🍲 따뜻한 국물",
  "🍫 초콜릿",
  "🍓 과일",
  "🍨 아이스크림",
  "🍜 라면",
  "🍗 치킨",
  "🍰 빵/디저트",
  "🌶️ 매운 음식",
  "🍚 집밥 느낌",
] as const;

const ALL_PRESET_CHOICES: ReadonlySet<string> = new Set<string>([
  ...DISPOSITION_OPTIONS,
  ...STRENGTH_OPTIONS,
  ...WEAKNESS_OPTIONS,
  ...STRESS_RELIEF_OPTIONS,
  ...HOBBY_OPTIONS,
  ...FAVORITE_HOBBY_OPTIONS,
  ...MAIN_ACTIVITY_OPTIONS,
  ...FOOD_OPTIONS,
]);

function splitChoices(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/,\s*|\s+\/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** "🎨 그림 그리기" → "그림 그리기" */
export function choiceLabel(item: string): string {
  return item.replace(/^[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]+/, "").trim() || item.trim();
}

/** The app's own chip labels in a stored profile value (emoji dropped). */
export function presetChoices(value: string | null | undefined): string[] {
  return splitChoices(value)
    .filter((item) => ALL_PRESET_CHOICES.has(item))
    .map(choiceLabel);
}

/** What the child typed under "기타" (anything that is not a chip label). */
export function freeTextChoices(value: string | null | undefined): string[] {
  return splitChoices(value).filter((item) => !ALL_PRESET_CHOICES.has(item));
}
