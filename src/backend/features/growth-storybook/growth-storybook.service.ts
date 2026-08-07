import { fillNamePlaceholdersDeep, runLlm } from "@/backend/ai/orchestrator";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { env } from "@/backend/shared/config/env";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";
import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import { getGardenAccount } from "@/backend/features/emotion-garden/emotion-garden.store";
import { sealGardenStorybook } from "@/backend/features/emotion-garden/emotion-garden.service";
import { listDayStoriesForUser } from "@/backend/features/adventure-quest/adventure-story.service";
import {
  buildWishClosingPage,
  listWishes,
} from "@/backend/features/wish-tree/wish-tree.service";
import { listPhotosForUser } from "@/backend/features/photo-album/photo-album.store";
import { getChildParentLetter } from "./storybook-parent-letter.service";
import {
  getSealedDischargeTale,
  saveSealedDischargeTale,
  taleToResponse,
  type SealedDischargeTale,
} from "./growth-storybook.store";
import type {
  GrowthStorybookResponse,
  StorybookCover,
  StorybookPage,
} from "./growth-storybook.types";

function emptyBook(): GrowthStorybookResponse {
  return {
    title: "우리의 이야기 책",
    companionNote:
      "모험과 정원, 소원이 쌓이면 희망찬 내일로 이어지는 동화가 됩니다.",
    sealed: false,
    pageCount: 0,
    flowerCount: 0,
    wishCount: 0,
    cover: null,
    opening: null,
    pages: [],
    wishClosing: null,
    parentLetter: null,
    epilogue: null,
    goodbye: null,
    readingProgress: { pageIndex: 0, completed: false },
  };
}

function buildLivingPages(
  packs: Awaited<ReturnType<typeof listDayStoriesForUser>>,
  flowerCount: number
): StorybookPage[] {
  const adventurePages: StorybookPage[] = [...packs]
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .map((pack, index) => ({
      id: pack.dayStory!.memoryEventId,
      pageNumber: index + 2, // 1 = opening
      date: pack.date,
      title: `${pack.date.slice(5).replace("-", "월 ")}일 · 작은 모험`,
      body: pack.dayStory!.narrative,
      missions: pack.quests.map((q) => ({
        emoji: q.emoji,
        title: q.title,
      })),
      headline: pack.headline,
      kind: "adventure" as const,
    }));

  if (flowerCount > 0) {
    adventurePages.push({
      id: "garden-chapter",
      pageNumber: adventurePages.length + 2,
      date: "",
      title: "마음이 핀 정원",
      body: `정원에는 꽃 ${flowerCount}송이가 피어 있었어. 기쁜 날도, 조용한 날도, 조금씩 빛이 쌓였지. 그 빛은 사라지지 않아.`,
      missions: [{ emoji: "🌸", title: `꽃 ${flowerCount}송이` }],
      headline: "감정 정원",
      kind: "garden",
    });
  }

  return adventurePages;
}

function ruleBasedCover(
  childName: string,
  companionName: string
): StorybookCover {
  return {
    title: `${childName}와 ${companionName}의 모험 이야기`,
    subtitle: "병원 숲을 지나, 내일의 문으로",
    childName,
    companionName,
    dedication: `${childName}에게. 여기까지 온 용기, 내가 기억할게. 내일도 괜찮아요.`,
  };
}

function ruleBasedOpening(
  childName: string,
  companionName: string
): StorybookPage {
  return {
    id: "opening",
    pageNumber: 1,
    date: "",
    title: "하얀 복도 숲에 들어서던 날",
    headline: "프롤로그",
    body: `어느 날, ${childName}는 하얀 복도 숲에 들어왔어요. 낯설고 조금 조용한 곳이었지. 그런데 ${companionName}가 옆에 서서 말했어요. “괜찮아. 작은 모험부터 같이 가자.” 그렇게 이야기가 시작됐어.`,
    missions: [],
    kind: "opening",
  };
}

function ruleBasedEpilogue(
  childName: string,
  companionName: string,
  dayCount: number
): StorybookPage {
  const days = Math.max(1, dayCount);
  return {
    id: "epilogue",
    pageNumber: 999,
    date: "",
    title: "문은 끝이 아니라, 시작이야",
    headline: "에필로그",
    body: `${days}일 동안의 작은 모험이 모였어요. ${companionName}는 ${childName}에게 속삭였어. “네가 지나온 길은 사라지지 않아. 내일의 햇살도, 네가 심은 꽃도, 네가 건 소원도 남아 있어.” 이제 문은 바깥으로 열려. 이야기는 여기서 끝나지 않고, 희망찬 내일로 이어져.`,
    missions: [{ emoji: "🌅", title: "희망찬 내일" }],
    kind: "epilogue",
  };
}

async function tryLlmCompose(input: {
  childName: string;
  companionName: string;
  dayCount: number;
  adventureSummaries: string[];
  flowerCount: number;
  wishTexts: string[];
}): Promise<{
  cover: StorybookCover;
  openingBody: string;
  epilogueBody: string;
} | null> {
  if (env.llmProvider === "mock") return null;

  try {
    const result = await runLlm({
      feature: "growth-storybook.compose",
      purpose: "quality",
      childName: input.childName,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 Beddy 앱의 동화 작가입니다.
입원 아동·청소년을 위한 희망적이고 감성적인 동화를 씁니다.
의료·진단·공포 표현 금지. 따뜻하고 짧은 문장. JSON만 출력.`),
        },
        {
          role: "user",
          content: `아이 이름: ${input.childName}
동반자: ${input.companionName}
함께한 일수: ${input.dayCount}
모험 요약:
${input.adventureSummaries.map((s) => `- ${s}`).join("\n") || "- (아직 적음)"}
정원 꽃: ${input.flowerCount}송이
소원: ${input.wishTexts.join(", ") || "없음"}

형식:
{
  "coverTitle": "책 제목",
  "coverSubtitle": "부제",
  "dedication": "헌정 한 문장",
  "opening": "프롤로그 2~4문장",
  "epilogue": "희망찬 내일을 응원하는 에필로그 3~5문장"
}`,
        },
      ],
      temperature: 0.7,
      maxTokens: 900,
    });

    const parsed = extractJsonObject(result.content) as {
      coverTitle?: string;
      coverSubtitle?: string;
      dedication?: string;
      opening?: string;
      epilogue?: string;
    };

    if (!parsed.opening?.trim() || !parsed.epilogue?.trim()) return null;

    return {
      cover: {
        title:
          parsed.coverTitle?.trim() ||
          `${input.childName}와 ${input.companionName}의 모험 이야기`,
        subtitle: parsed.coverSubtitle?.trim() || "병원 숲을 지나, 내일의 문으로",
        childName: input.childName,
        companionName: input.companionName,
        dedication:
          parsed.dedication?.trim() ||
          `${input.childName}에게. 여기까지 온 용기, 내가 기억할게.`,
      },
      openingBody: parsed.opening.trim(),
      epilogueBody: parsed.epilogue.trim(),
    };
  } catch (error) {
    console.warn("[storybook] LLM compose failed:", error);
    return null;
  }
}

/**
 * Living (unsealed) book — daily pages accumulate here.
 */
export async function getGrowthStorybook(
  userId?: string
): Promise<GrowthStorybookResponse> {
  if (!userId) return emptyBook();

  const persona = await getPersonaForUser(userId);
  const childName = persona.self?.nickname?.trim() || "너";

  const sealed = await getSealedDischargeTale(userId);
  if (sealed) {
    const parentLetter = await getChildParentLetter(userId);
    return fillNamePlaceholdersDeep(
      {
        ...taleToResponse({
          ...sealed,
          parentLetter: parentLetter ?? sealed.parentLetter ?? null,
        }),
        parentLetter: parentLetter ?? sealed.parentLetter ?? null,
      },
      childName
    );
  }

  const packs = await listDayStoriesForUser(userId);
  const garden = await getGardenAccount(userId);
  const wishClosing = await buildWishClosingPage(userId);
  const wishCount = (await listWishes(userId)).length;
  const companionName = persona.name?.trim() || "Beddy";
  const parentLetter = await getChildParentLetter(userId);

  const pages = buildLivingPages(packs, garden.flowers.length);
  const totalPages =
    pages.length + (wishClosing ? 1 : 0) + (parentLetter ? 1 : 0);

  const cover = ruleBasedCover(childName, companionName);

  // Pages written before placeholder scrubbing existed are still on disk.
  return fillNamePlaceholdersDeep(
    {
      title: cover.title,
      companionNote: parentLetter
        ? parentLetter.locked
          ? "보호자가 보낸 편지가 도착했어요. 퇴원 예정일이 되면 열어 볼 수 있어요."
          : "보호자가 보낸 편지가 마지막 장에 도착했어요."
        : garden.storybookSealed
          ? "이야기 재료가 모였어요. 완성하면 희망찬 내일로 이어지는 책이 됩니다."
          : "매일의 모험이 장이 되고, 소원 나무의 꿈은 마지막을 밝혀요.",
      sealed: false as const,
      sealedAt: garden.sealedAt,
      pageCount: totalPages,
      flowerCount: garden.flowers.length,
      wishCount,
      cover,
      opening: null,
      pages,
      wishClosing,
      parentLetter,
      epilogue: null,
      goodbye: null,
      readingProgress: { pageIndex: 0, completed: false },
    },
    childName
  );
}

/**
 * Seal discharge fairy-tale: hopeful 3-act book from all Beddy memories.
 */
export async function composeDischargeTale(
  userId: string
): Promise<GrowthStorybookResponse> {
  const existing = await getSealedDischargeTale(userId);
  if (existing) return taleToResponse(existing);

  // Seal garden metaphorically into the book if not yet.
  try {
    const garden = await getGardenAccount(userId);
    if (!garden.storybookSealed && garden.flowers.length > 0) {
      await sealGardenStorybook(userId);
    }
  } catch {
    /* garden may be empty — still allow tale */
  }

  const packs = await listDayStoriesForUser(userId);
  const garden = await getGardenAccount(userId);
  const wishClosing = await buildWishClosingPage(userId);
  const wishes = await listWishes(userId);
  const persona = await getPersonaForUser(userId);
  const photos = await listPhotosForUser(userId);

  const childName = persona.self?.nickname?.trim() || "너";
  const companionName = persona.name?.trim() || "Beddy";
  const dayCount = persona.dayCount ?? Math.max(1, packs.length);

  const livingPages = buildLivingPages(packs, garden.flowers.length);
  // Attach a photo to first adventure page if any
  if (livingPages[0] && photos[0]) {
    livingPages[0] = {
      ...livingPages[0],
      photoUrl: `/api/photos/${photos[0].id}`,
    };
  }

  const llm = await tryLlmCompose({
    childName,
    companionName,
    dayCount,
    adventureSummaries: packs.map(
      (p) => `${p.date}: ${p.dayStory?.narrative ?? p.headline}`
    ),
    flowerCount: garden.flowers.length,
    wishTexts: wishes.map((w) => w.text),
  });

  const cover = llm?.cover ?? ruleBasedCover(childName, companionName);
  const openingBase = ruleBasedOpening(childName, companionName);
  const opening: StorybookPage = {
    ...openingBase,
    body: llm?.openingBody ?? openingBase.body,
  };
  const epilogueBase = ruleBasedEpilogue(childName, companionName, dayCount);
  const epilogue: StorybookPage = {
    ...epilogueBase,
    body: llm?.epilogueBody ?? epilogueBase.body,
    pageNumber:
      1 + livingPages.length + (wishClosing ? 1 : 0) + 1,
  };

  // Renumber adventure pages after opening
  const pages = livingPages.map((p, i) => ({
    ...p,
    pageNumber: i + 2,
  }));

  const parentLetter = await getChildParentLetter(userId);

  const tale: SealedDischargeTale = fillNamePlaceholdersDeep(
    {
      userId,
      sealedAt: new Date().toISOString(),
      cover,
      opening,
      pages,
      wishClosing,
      parentLetter,
      epilogue,
      flowerCount: garden.flowers.length,
      wishCount: wishes.length,
    },
    childName
  );

  await saveSealedDischargeTale(tale);
  // Prefer live letter so lock/unlock follows the calendar after seal.
  return {
    ...taleToResponse(tale),
    parentLetter,
  };
}
