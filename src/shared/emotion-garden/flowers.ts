/**
 * Emotion → flower catalogue.
 * Every feeling deserves a beautiful bloom — including the hard ones.
 * Keep existing MoodIds stable so stored gardens and downstream readers stay valid.
 */

import type { MoodId, MoodOption } from "./types";

export interface FlowerSpecies {
  id: MoodId;
  /** Soft pastel for petals / UI accents */
  palette: {
    petal: string;
    petalDeep: string;
    center: string;
    leaf: string;
    soil: string;
    glow: string;
  };
  flowerName: string;
  emotionLabel: string;
  /** Short child-facing note */
  note: string;
  /** Soft emoji used as a compact cue (SVG is the real illustration) */
  emoji: string;
}

export const FLOWER_CATALOG: Record<MoodId, FlowerSpecies> = {
  happy: {
    id: "happy",
    flowerName: "해바라기",
    emotionLabel: "기쁨",
    emoji: "🌻",
    note: "가볍게 웃을 수 있었던 하루에 피어요.",
    palette: {
      petal: "#F6D96B",
      petalDeep: "#E8B84A",
      center: "#8B5A2B",
      leaf: "#7CB88A",
      soil: "#C4A484",
      glow: "rgba(246, 217, 107, 0.35)",
    },
  },
  brave: {
    id: "brave",
    flowerName: "튤립",
    emotionLabel: "용기",
    emoji: "🌷",
    note: "조금 무서워도 한 걸음 내디딘 하루에 피어요.",
    palette: {
      petal: "#F4A7B9",
      petalDeep: "#E8789A",
      center: "#F7E6EB",
      leaf: "#6FAF7A",
      soil: "#C4A484",
      glow: "rgba(244, 167, 185, 0.35)",
    },
  },
  hope: {
    id: "hope",
    flowerName: "데이지",
    emotionLabel: "희망",
    emoji: "🌼",
    note: "내일도 괜찮을 것 같았던 하루에 피어요.",
    palette: {
      petal: "#FFF8E7",
      petalDeep: "#F5E6C8",
      center: "#F0C14A",
      leaf: "#8BC49A",
      soil: "#C4A484",
      glow: "rgba(240, 193, 74, 0.3)",
    },
  },
  calm: {
    id: "calm",
    flowerName: "수국",
    emotionLabel: "평온",
    emoji: "💙",
    note: "숨이 고르고 마음이 고요했던 하루에 피어요.",
    palette: {
      petal: "#A8C8E8",
      petalDeep: "#7BA8D4",
      center: "#E8F0F8",
      leaf: "#6FAF8A",
      soil: "#C4A484",
      glow: "rgba(168, 200, 232, 0.4)",
    },
  },
  love: {
    id: "love",
    flowerName: "벚꽃",
    emotionLabel: "사랑받음",
    emoji: "🌸",
    note: "누군가·무언가가 따뜻했던 하루에 피어요.",
    palette: {
      petal: "#F8C8D8",
      petalDeep: "#EFA0B8",
      center: "#FDF0F4",
      leaf: "#8BC49A",
      soil: "#C4A484",
      glow: "rgba(248, 200, 216, 0.4)",
    },
  },
  sleepy: {
    id: "sleepy",
    flowerName: "라벤더",
    emotionLabel: "지침",
    emoji: "💜",
    note: "쉬는 날에도 정원은 조용히 곁에 있어요.",
    palette: {
      petal: "#C4B0E0",
      petalDeep: "#A088C8",
      center: "#E8E0F4",
      leaf: "#7A9B7A",
      soil: "#C4A484",
      glow: "rgba(196, 176, 224, 0.4)",
    },
  },
  sad: {
    id: "sad",
    flowerName: "블루벨",
    emotionLabel: "슬픔",
    emoji: "💧",
    note: "눈물이 나도 괜찮아요. 이슬을 머금고 자라요.",
    palette: {
      petal: "#8EB4E0",
      petalDeep: "#6A94C8",
      center: "#D8E8F8",
      leaf: "#6FAF8A",
      soil: "#C4A484",
      glow: "rgba(142, 180, 224, 0.4)",
    },
  },
  lonely: {
    id: "lonely",
    flowerName: "물망초",
    emotionLabel: "외로움",
    emoji: "🩵",
    note: "혼자인 느낌도 기억으로 남을 수 있어요.",
    palette: {
      petal: "#9EC8F0",
      petalDeep: "#7AA8D8",
      center: "#F0C14A",
      leaf: "#7CB88A",
      soil: "#C4A484",
      glow: "rgba(158, 200, 240, 0.4)",
    },
  },
  angry: {
    id: "angry",
    flowerName: "붉은 양귀비",
    emotionLabel: "답답함",
    emoji: "🌺",
    note: "화가 나도 여기는 안전한 자리예요.",
    palette: {
      petal: "#E88888",
      petalDeep: "#D06060",
      center: "#3A2A1A",
      leaf: "#6FAF7A",
      soil: "#C4A484",
      glow: "rgba(232, 136, 136, 0.35)",
    },
  },
};

export const MOOD_OPTIONS: MoodOption[] = (
  Object.keys(FLOWER_CATALOG) as MoodId[]
).map((id) => ({
  id,
  emoji: FLOWER_CATALOG[id].emoji,
  label: FLOWER_CATALOG[id].emotionLabel,
}));

export const ALL_MOOD_IDS: MoodId[] = MOOD_OPTIONS.map((m) => m.id);

export function isMoodId(value: unknown): value is MoodId {
  return typeof value === "string" && value in FLOWER_CATALOG;
}

export function flowerForMood(mood: MoodId): FlowerSpecies {
  return FLOWER_CATALOG[mood];
}
