import "server-only";
import { runLlm } from "@/backend/ai/orchestrator";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { env } from "@/backend/shared/config/env";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";
import { listEmotionRecords } from "@/backend/features/emotion-analysis/emotion.store";
import { getConversationMemory } from "@/backend/features/conversation/conversation.store";
import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import { ALL_WISH_KINDS, guessWishKind, isWishKind } from "./wish-tree.leaves";
import type { WishInspiration, WishKind } from "./wish-tree.types";

const STATIC_LINES: Array<{ text: string; kind: WishKind }> = [
  { text: "친구랑 마음껏 뛰어놀고 싶어요", kind: "play" },
  { text: "우리 집 내 방 침대에 눕고 싶어요", kind: "home" },
  { text: "창문 밖 바람을 직접 맞고 싶어요", kind: "outside" },
];

function fallback(): WishInspiration {
  return { lines: STATIC_LINES, source: "static" };
}

/**
 * Offer a few starting lines drawn from what the child has been talking about.
 * The child still writes their own wish — these are only there for a blank page.
 */
export async function suggestWishInspiration(
  userId: string
): Promise<WishInspiration> {
  if (!userId || userId === "anonymous" || env.llmProvider === "mock") {
    return fallback();
  }

  const [records, memory, persona] = await Promise.all([
    listEmotionRecords(userId).catch(() => []),
    getConversationMemory(userId).catch(() => null),
    getPersonaForUser(userId).catch(() => null),
  ]);

  const recentEmotions = records
    .slice(-6)
    .map((r) => `${r.primaryEmotion} ${r.summary} ${r.keywords.join(" ")}`)
    .join("\n")
    .slice(0, 700);
  const themes = (memory?.emotionalThemes ?? []).slice(0, 5).join(", ");
  const childName = persona?.self?.nickname?.trim() || "아이";

  if (!recentEmotions && !themes) return fallback();

  try {
    const result = await runLlm({
      feature: "wish.tree.inspiration",
      purpose: "analysis",
      childName: persona?.self?.nickname?.trim(),
      temperature: 0.7,
      maxTokens: 320,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 Beddy의 마음 나무 도우미입니다.
입원 중인 아이가 "무엇을 적을지 모를 때" 참고할 소원 문장 3개를 제안하세요.

규칙:
- 아이가 실제로 말한 주제에서 출발하되, 원문을 그대로 옮기지 마세요.
- 각 문장은 한국어 12~22자, "~하고 싶어요" 같은 아이 말투.
- 치료·증상·진단·통증은 소재로 쓰지 마세요. 낫고 싶은 바람은 괜찮습니다.
- 점수·보상·경쟁 표현 금지. 부담 주는 표현 금지.
- kind는 다음 중 하나: ${ALL_WISH_KINDS.join(", ")}

반드시 JSON만 출력:
{"lines":[{"text":"...","kind":"..."},{"text":"...","kind":"..."},{"text":"...","kind":"..."}]}`),
        },
        {
          role: "user",
          content: `아이 이름: ${childName}
최근 감정 기록:
${recentEmotions || "(없음)"}

대화 키워드: ${themes || "(없음)"}`,
        },
      ],
    });

    const parsed = extractJsonObject(result.content) as {
      lines?: Array<{ text?: string; kind?: string }>;
    };

    const lines = (parsed.lines ?? [])
      .map((line) => {
        const text = typeof line.text === "string" ? line.text.trim() : "";
        if (text.length < 4) return null;
        const clipped = text.slice(0, 40);
        return {
          text: clipped,
          kind: isWishKind(line.kind) ? line.kind : guessWishKind(clipped),
        };
      })
      .filter((line): line is { text: string; kind: WishKind } => line !== null)
      .slice(0, 3);

    if (lines.length > 0) return { lines, source: "llm" };
  } catch (error) {
    console.warn("[wish-tree] inspiration LLM failed", error);
  }

  return fallback();
}
