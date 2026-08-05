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
