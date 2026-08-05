import {

  getWishTreeAccount,

  listWishes,

  saveWishTreeAccount,

} from "./wish-tree.store";

import type {

  WishHorizon,

  WishItem,

  WishTreeResponse,

} from "./wish-tree.types";



export { listWishes };



const SUGGESTIONS: WishTreeResponse["suggestions"] = [

  {

    emoji: "⚽",

    text: "친구랑 축구하고 싶어요",

    horizon: "after_discharge",

  },

  {

    emoji: "🐕",

    text: "강아지 보고 싶어요",

    horizon: "after_discharge",

  },

  {

    emoji: "🎢",

    text: "엄마랑 놀이공원 가고 싶어요",

    horizon: "after_discharge",

  },

  {

    emoji: "🍦",

    text: "병실에서 아이스크림 먹고 싶어요",

    horizon: "hospital",

  },

  {

    emoji: "🎮",

    text: "좋아하는 게임 한판 하고 싶어요",

    horizon: "anytime",

  },

];



const EMOJI_CYCLE = ["🌟", "🍃", "🌈", "🎈", "🌙", "🍀", "✨", "🦋"];



function pickEmoji(text: string, index: number): string {

  const lower = text.toLowerCase();

  if (lower.includes("축구") || lower.includes("운동")) return "⚽";

  if (lower.includes("강아지") || lower.includes("고양이") || lower.includes("동물"))

    return "🐕";

  if (lower.includes("놀이공원") || lower.includes("놀이기구")) return "🎢";

  if (lower.includes("엄마") || lower.includes("아빠") || lower.includes("가족"))

    return "💝";

  if (lower.includes("친구")) return "🤝";

  if (lower.includes("바다") || lower.includes("수영")) return "🌊";

  if (lower.includes("학교")) return "📚";

  return EMOJI_CYCLE[index % EMOJI_CYCLE.length];

}



export async function getWishTree(userId?: string): Promise<WishTreeResponse> {

  const wishes = userId ? (await getWishTreeAccount(userId)).wishes : [];

  return {

    title: "소원 나무",

    companionNote:

      wishes.length === 0

        ? "병원에서 하고 싶은 것, 퇴원하면 하고 싶은 것을 나무에 걸어 두세요. 베디가 기억해 둘게요."

        : `나무가 ${wishes.length}개의 소원을 품고 있어요. 퇴원할 때 스토리북 마지막 장에 함께 적힐 거예요.`,

    wishes: [...wishes].sort((a, b) =>

      a.createdAt < b.createdAt ? 1 : -1

    ),

    suggestions: SUGGESTIONS,

  };

}



export async function addWish(

  userId: string,

  text: string,

  horizon: WishHorizon = "anytime"

): Promise<WishTreeResponse> {

  const cleaned = text.trim().slice(0, 80);

  if (cleaned.length < 2) {

    throw new Error("소원을 조금 더 적어 주세요.");

  }



  const account = await getWishTreeAccount(userId);

  if (account.wishes.length >= 40) {

    throw new Error("소원이 가득 찼어요. 나중에 하나씩 이뤄 보자.");

  }



  const wish: WishItem = {

    id: `wish-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,

    text: cleaned,

    horizon,

    emoji: pickEmoji(cleaned, account.wishes.length),

    createdAt: new Date().toISOString(),

  };



  await saveWishTreeAccount({

    ...account,

    wishes: [wish, ...account.wishes],

  });



  return getWishTree(userId);

}



export async function removeWish(

  userId: string,

  wishId: string

): Promise<WishTreeResponse> {

  const account = await getWishTreeAccount(userId);

  await saveWishTreeAccount({

    ...account,

    wishes: account.wishes.filter((w) => w.id !== wishId),

  });

  return getWishTree(userId);

}



/** For companion prompt + storybook last page */

export async function formatWishesForPrompt(userId: string): Promise<string> {

  const wishes = (await getWishTreeAccount(userId)).wishes;

  if (wishes.length === 0) {

    return "아직 소원 나무에 걸린 소원이 없습니다.";

  }

  return wishes

    .slice(0, 12)

    .map((w) => `- ${w.emoji} ${w.text} (${horizonLabel(w.horizon)})`)

    .join("\n");

}



export function horizonLabel(horizon: WishHorizon): string {

  if (horizon === "hospital") return "병원에서도";

  if (horizon === "after_discharge") return "퇴원하면";

  return "언젠가";

}



export async function buildWishClosingPage(userId: string): Promise<{

  title: string;

  headline: string;

  body: string;

  wishes: Array<{ emoji: string; text: string }>;

} | null> {

  const wishes = (await getWishTreeAccount(userId)).wishes;

  if (wishes.length === 0) return null;



  const lines = wishes

    .slice(0, 10)

    .map((w) => `${w.emoji} ${w.text}`)

    .join("\n");



  return {

    title: "소원 나무의 마지막 장",

    headline: "🌿 우리가 걸어 둔 꿈들",

    body: `이제 병원 밖에서 이 꿈들을 하나씩 이루러 가자.\n\n${lines}\n\n급할 필요 없어. 하나씩, 천천히. 베디도 응원할게.`,

    wishes: wishes.slice(0, 10).map((w) => ({

      emoji: w.emoji,

      text: w.text,

    })),

  };

}

