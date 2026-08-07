/**
 * Wish → leaf catalogue.
 * A wish is a kind of longing, so each kind gets its own leaf shape and colour.
 * The tree should never look repetitive — shape carries personality, colour carries feeling.
 * Keep ids stable: stored leaves and downstream readers depend on them.
 */

import type { LeafShape, WishKind, WishKindOption } from "./types";

export interface LeafSpecies {
  id: WishKind;
  /** Child-facing name of the longing, used as the chip label */
  label: string;
  /** One soft line explaining when this leaf fits */
  hint: string;
  shape: LeafShape;
  /** Compact cue for text-only places (prompts, storybook). SVG is the real thing. */
  emoji: string;
  palette: {
    leaf: string;
    leafDeep: string;
    vein: string;
    glow: string;
  };
}

export const LEAF_CATALOG: Record<WishKind, LeafSpecies> = {
  play: {
    id: "play",
    label: "놀고 싶어요",
    hint: "뛰고, 웃고, 신나게 놀고 싶은 마음",
    shape: "round",
    emoji: "🌿",
    palette: {
      leaf: "#B8DE8A",
      leafDeep: "#8FC463",
      vein: "#6FA847",
      glow: "rgba(184, 222, 138, 0.5)",
    },
  },
  meet: {
    id: "meet",
    label: "보고 싶어요",
    hint: "친구, 가족, 반려동물이 그리운 마음",
    shape: "ginkgo",
    emoji: "🍂",
    palette: {
      leaf: "#F6C89A",
      leafDeep: "#E8A874",
      vein: "#CE8B58",
      glow: "rgba(246, 200, 154, 0.5)",
    },
  },
  home: {
    id: "home",
    label: "집에 가고 싶어요",
    hint: "내 방, 내 이불, 익숙한 곳이 떠오르는 마음",
    shape: "heart",
    emoji: "🍁",
    palette: {
      leaf: "#F2A38C",
      leafDeep: "#DD8068",
      vein: "#C4674F",
      glow: "rgba(242, 163, 140, 0.5)",
    },
  },
  outside: {
    id: "outside",
    label: "밖에 나가고 싶어요",
    hint: "바람, 하늘, 바깥 공기가 그리운 마음",
    shape: "willow",
    emoji: "🍃",
    palette: {
      leaf: "#A8D2E8",
      leafDeep: "#7FB4D4",
      vein: "#6396B8",
      glow: "rgba(168, 210, 232, 0.5)",
    },
  },
  taste: {
    id: "taste",
    label: "먹고 싶어요",
    hint: "좋아하는 음식이 생각나는 마음",
    shape: "teardrop",
    emoji: "🍋",
    palette: {
      leaf: "#FAD9A0",
      leafDeep: "#F0BF74",
      vein: "#D6A254",
      glow: "rgba(250, 217, 160, 0.5)",
    },
  },
  heal: {
    id: "heal",
    label: "다 낫고 싶어요",
    hint: "안 아프고 튼튼해지고 싶은 마음",
    shape: "clover",
    emoji: "🍀",
    palette: {
      leaf: "#A8DEC8",
      leafDeep: "#7BC4A8",
      vein: "#5EA88B",
      glow: "rgba(168, 222, 200, 0.5)",
    },
  },
  make: {
    id: "make",
    label: "해보고 싶어요",
    hint: "배우고, 만들고, 처음 해보고 싶은 마음",
    shape: "star",
    emoji: "🌱",
    palette: {
      leaf: "#C9B8E8",
      leafDeep: "#A894D4",
      vein: "#8B77B8",
      glow: "rgba(201, 184, 232, 0.5)",
    },
  },
  rest: {
    id: "rest",
    label: "편히 쉬고 싶어요",
    hint: "조용히, 아무것도 안 하고 싶은 마음",
    shape: "oval",
    emoji: "🌙",
    palette: {
      leaf: "#B8C8DC",
      leafDeep: "#94A8C4",
      vein: "#7A8CA8",
      glow: "rgba(184, 200, 220, 0.5)",
    },
  },
};

export const WISH_KIND_OPTIONS: WishKindOption[] = (
  Object.keys(LEAF_CATALOG) as WishKind[]
).map((id) => ({
  id,
  label: LEAF_CATALOG[id].label,
  hint: LEAF_CATALOG[id].hint,
  emoji: LEAF_CATALOG[id].emoji,
}));

export const ALL_WISH_KINDS: WishKind[] = WISH_KIND_OPTIONS.map((k) => k.id);

export function isWishKind(value: unknown): value is WishKind {
  return typeof value === "string" && value in LEAF_CATALOG;
}

export function leafForKind(kind: WishKind): LeafSpecies {
  return LEAF_CATALOG[kind];
}

const KIND_KEYWORDS: Array<{ re: RegExp; kind: WishKind }> = [
  { re: /집|우리 ?집|내 ?방|퇴원|돌아가/, kind: "home" },
  {
    re: /낫고|나아서|나았|다 ?낫|안 ?아프|아프지|건강|튼튼|주사|수술|치료|검사/,
    kind: "heal",
  },
  { re: /먹|맛있|아이스크림|치킨|피자|과자|급식|라면|음식/, kind: "taste" },
  {
    re: /보고 ?싶|만나|친구|엄마|아빠|형|누나|언니|오빠|동생|할머니|할아버지|강아지|고양이|반려/,
    kind: "meet",
  },
  {
    re: /나가|바깥|밖|산책|바다|여행|공원|하늘|바람|놀이공원|캠핑/,
    kind: "outside",
  },
  { re: /놀|게임|축구|자전거|수영|뛰|장난감|재밌|신나/, kind: "play" },
  { re: /쉬|자고|잠|눕|조용|편하|혼자 ?있/, kind: "rest" },
  { re: /배우|만들|그리|하고 ?싶|해보|도전|공부|학교|피아노/, kind: "make" },
];

/**
 * Best-guess the kind of longing from the child's own words.
 * Only a default — the child can always pick a different leaf.
 */
export function guessWishKind(text: string): WishKind {
  for (const row of KIND_KEYWORDS) {
    if (row.re.test(text)) return row.kind;
  }
  return "make";
}
