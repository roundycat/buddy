import { createMapStore } from "@/backend/shared/persist/map-store";
import { runLlm } from "@/backend/ai/orchestrator";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { env } from "@/backend/shared/config/env";
import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import {
  formatMemoryForPrompt,
  getConversationMemory,
} from "@/backend/features/conversation/conversation.store";
import { listDayStoriesForUser } from "@/backend/features/adventure-quest/adventure-story.service";
import { getGardenAccount } from "@/backend/features/emotion-garden/emotion-garden.store";
import { listWishes } from "@/backend/features/wish-tree/wish-tree.service";
import { todayKey } from "@/backend/shared/time/date";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";
import type { MemoryLetter, MemoryPostResponse } from "./memory-post.types";

interface LetterBag {
  userId: string;
  letters: MemoryLetter[];
}

const store = createMapStore<LetterBag>("memory-post.json");

async function getLetters(userId: string): Promise<MemoryLetter[]> {
  return [...((await store.get(userId))?.letters ?? [])];
}

async function saveLetters(userId: string, letters: MemoryLetter[]) {
  await store.set(userId, { userId, letters: letters.slice(0, 40) });
}

function seedFromLife(input: {
  companionName: string;
  dayStory?: string | null;
  flowerNote?: string | null;
  wishText?: string | null;
}): MemoryLetter[] {
  const today = todayKey();
  const letters: MemoryLetter[] = [];

  if (input.dayStory) {
    letters.push({
      id: `kept-adv-${today}`,
      kind: "kept",
      title: "보관함 · 오늘의 모험",
      body: input.dayStory.slice(0, 160),
      stampedAt: today,
    });
  }
  if (input.flowerNote) {
    letters.push({
      id: `self-${today}`,
      kind: "to_self",
      title: "나에게 남긴 메모",
      body: input.flowerNote.slice(0, 160),
      stampedAt: today,
    });
  }
  if (input.wishText) {
    letters.push({
      id: `future-${today}`,
      kind: "to_future",
      title: "퇴원 후의 나에게",
      body: `그때의 나에게. 오늘은 이런 소원을 걸었어: ${input.wishText.slice(0, 80)}`,
      stampedAt: today,
    });
  }

  return letters;
}

async function maybeCompanionLetter(userId: string): Promise<MemoryLetter | null> {
  const existing = await getLetters(userId);
  const today = todayKey();
  if (existing.some((l) => l.kind === "from_friend" && l.stampedAt === today)) {
    return null;
  }

  const [persona, memory, stories, garden, wishes] = await Promise.all([
    getPersonaForUser(userId),
    getConversationMemory(userId),
    listDayStoriesForUser(userId),
    getGardenAccount(userId),
    listWishes(userId),
  ]);

  const companionName = persona.name?.trim() || "Beddy";
  const childName = persona.self?.nickname?.trim() || "너";
  const fallback: MemoryLetter = {
    id: `friend-${today}`,
    kind: "from_friend",
    title: `${companionName}의 짧은 편지`,
    body: `${childName}, 오늘도 여기까지 온 거 내가 알아. 말이 없어도 옆에 있을게.`,
    stampedAt: today,
    unread: true,
  };

  try {
    if (env.llmProvider === "mock") return fallback;

    const result = await runLlm({
      feature: "memory.post",
      purpose: "analysis",
      temperature: 0.7,
      maxTokens: 280,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 ${companionName}입니다. 아이에게 짧은 편지를 씁니다.
원문 대화 인용 금지. JSON만:
{ "title": "짧은 제목", "body": "2~4문장" }`),
        },
        {
          role: "user",
          content: `아이: ${childName}
학습 메모리 요약:
${formatMemoryForPrompt(memory)}
최근 모험 이야기: ${stories[0]?.dayStory?.narrative?.slice(0, 120) ?? "아직 없음"}
정원 꽃: ${garden.flowers.length}송이
소원: ${wishes[0]?.text ?? "없음"}`,
        },
      ],
    });

    const parsed = extractJsonObject(result.content) as {
      title?: string;
      body?: string;
    };
    if (!parsed.body?.trim()) return fallback;

    return {
      id: `friend-${today}`,
      kind: "from_friend",
      title: parsed.title?.trim() || `${companionName}의 짧은 편지`,
      body: parsed.body.trim().slice(0, 280),
      stampedAt: today,
      unread: true,
    };
  } catch (error) {
    console.warn("[memory-post] companion letter LLM skipped", error);
    return fallback;
  }
}

/**
 * Memory Post — real letters from life events + LLM companion note.
 */
export async function getMemoryPost(
  userId?: string
): Promise<MemoryPostResponse> {
  if (!userId) {
    return {
      title: "기억 우체국",
      companionNote:
        "보내고 싶은 말은 여기에 맡겨 두세요. 지금은 읽기만 해도, 나중에 써도 괜찮아요.",
      letters: [],
    };
  }

  let letters = await getLetters(userId);

  if (letters.length === 0) {
    const [stories, garden, wishes, persona] = await Promise.all([
      listDayStoriesForUser(userId),
      getGardenAccount(userId),
      listWishes(userId),
      getPersonaForUser(userId),
    ]);
    letters = seedFromLife({
      companionName: persona.name?.trim() || "Beddy",
      dayStory: stories[0]?.dayStory?.narrative ?? null,
      flowerNote: garden.flowers[0]?.note ?? null,
      wishText: wishes[0]?.text ?? null,
    });
  }

  const companionLetter = await maybeCompanionLetter(userId);
  if (companionLetter) {
    letters = [
      companionLetter,
      ...letters.filter((l) => l.id !== companionLetter.id),
    ];
  }

  await saveLetters(userId, letters);

  return {
    title: "기억 우체국",
    companionNote:
      "보내고 싶은 말은 여기에 맡겨 두세요. 베디의 편지도 하루에 하나씩 도착해요.",
    letters: [...letters].sort((a, b) =>
      a.stampedAt < b.stampedAt ? 1 : -1
    ),
  };
}
