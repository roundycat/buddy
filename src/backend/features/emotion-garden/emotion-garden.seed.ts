import "server-only";
import { runLlm } from "@/backend/ai/orchestrator";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { env } from "@/backend/shared/config/env";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";
import { listEmotionRecords } from "@/backend/features/emotion-analysis/emotion.store";
import { getChildName } from "@/backend/features/persona/persona.store";
import { todayKey } from "@/backend/shared/time/date";
import { ALL_MOOD_IDS, flowerForMood, isMoodId } from "./emotion-garden.flowers";
import type {
  EmotionSeedSuggestion,
  MoodId,
} from "./emotion-garden.types";

const KEYWORD_MAP: Array<{ re: RegExp; mood: MoodId }> = [
  { re: /희망|기대|내일|괜찮/, mood: "hope" },
  { re: /용기|용감|무서|겁|도전/, mood: "brave" },
  { re: /평온|고요|편안|차분|숨/, mood: "calm" },
  { re: /외로|혼자|심심/, mood: "lonely" },
  { re: /사랑|따뜻|고마|다정|포옹/, mood: "love" },
  { re: /기쁨|행복|좋아|웃|신나/, mood: "happy" },
  { re: /피곤|지침|졸|힘들/, mood: "sleepy" },
  { re: /슬프|울|눈물|우울/, mood: "sad" },
  { re: /화|짜증|답답|억울/, mood: "angry" },
];

function heuristicMood(text: string): MoodId {
  for (const row of KEYWORD_MAP) {
    if (row.re.test(text)) return row.mood;
  }
  return "calm";
}

function toSuggestion(
  mood: MoodId,
  reason: string,
  source: EmotionSeedSuggestion["source"]
): EmotionSeedSuggestion {
  const flower = flowerForMood(mood);
  return {
    mood,
    flowerName: flower.flowerName,
    emoji: flower.emoji,
    reason: reason.slice(0, 80),
    source,
  };
}

/**
 * Suggest today's emotion seed from today's chat emotion analyses.
 * Child may accept or pick another mood — never forced.
 */
export async function suggestTodaySeed(
  userId: string,
  dateKey = todayKey()
): Promise<EmotionSeedSuggestion | null> {
  const records = (await listEmotionRecords(userId)).filter(
    (r) => r.dateKey === dateKey
  );
  if (records.length === 0) return null;

  const blob = records
    .map((r) => `${r.primaryEmotion} ${r.summary} ${r.keywords.join(" ")}`)
    .join("\n")
    .slice(0, 800);

  if (env.llmProvider !== "mock") {
    try {
      const result = await runLlm({
        feature: "emotion.garden.seed",
        childFacing: true,
        purpose: "analysis",
        childName: await getChildName(userId),
        temperature: 0.3,
        maxTokens: 180,
        messages: [
          {
            role: "system",
            content: withBeddySafety(`당신은 Beddy의 감정 정원 도우미입니다.
아이의 오늘 감정 기록을 보고 "오늘의 감정 씨앗" 하나를 고르세요.
반드시 JSON만 출력:
{"mood":"<id>","reason":"아이에게 건네는 부드러운 한 문장"}
mood는 다음 중 하나: ${ALL_MOOD_IDS.join(", ")}
부정 감정도 아름답게. 점수·보상·진단 표현 금지.`),
          },
          {
            role: "user",
            content: `오늘 감정 기록:\n${blob}`,
          },
        ],
      });
      const parsed = extractJsonObject(result.content) as {
        mood?: string;
        reason?: string;
      };
      if (isMoodId(parsed.mood)) {
        return toSuggestion(
          parsed.mood,
          parsed.reason?.trim() ||
            `오늘은 ${flowerForMood(parsed.mood).emotionLabel} 씨앗이 어울려 보여요.`,
          "llm"
        );
      }
    } catch (error) {
      console.warn("[garden] seed suggestion LLM failed", error);
    }
  }

  const mood = heuristicMood(blob);
  const flower = flowerForMood(mood);
  return toSuggestion(
    mood,
    `오늘은 ${flower.emotionLabel} 씨앗이 어울려 보여요.`,
    "heuristic"
  );
}
