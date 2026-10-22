import "server-only";
import { runLlm } from "@/backend/ai/orchestrator";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { env } from "@/backend/shared/config/env";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";
import {
  forLongTermRecords,
  getConversationHistory,
} from "@/backend/features/conversation/conversation.store";
import {
  appendEmotionRecord,
  listEmotionRecords,
} from "@/backend/features/emotion-analysis/emotion.store";
import { getChildName } from "@/backend/features/persona/persona.store";
import type { EmotionAnalysisRecord } from "@/backend/features/emotion-analysis/emotion.types";

/**
 * Nightly Emotion Analysis — one Bedrock pass for the day's chat sample.
 * Per-turn path stays heuristic-only to cut Bedrock calls on the hot path.
 */
export async function refineEmotionsForUser(
  userId: string,
  dateKey: string
): Promise<{ ok: boolean; refined: boolean }> {
  if (!userId || env.llmProvider === "mock") {
    return { ok: true, refined: false };
  }

  const existing = (await listEmotionRecords(userId)).filter(
    (r) => r.dateKey === dateKey && r.source === "chat"
  );
  const alreadyLlm = existing.some((r) => r.confidence >= 0.7);
  if (alreadyLlm) return { ok: true, refined: false };

  // Emotion records reach the guardian's screens: harm-by-someone turns stay out.
  const history = forLongTermRecords(await getConversationHistory(userId));
  const todaysUser = history
    .filter((m) => m.role === "user" && m.createdAt.startsWith(dateKey))
    .slice(-8)
    .map((m) => m.content.trim())
    .filter(Boolean);
  if (todaysUser.length === 0) return { ok: true, refined: false };

  try {
    const result = await runLlm({
      feature: "batch.emotion.refine",
      purpose: "analysis",
      childName: await getChildName(userId),
      temperature: 0.2,
      maxTokens: 280,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 Beddy의 야간 감정 정리기입니다.
아이 메시지 묶음에서 하루 대표 감정만 JSON으로 출력하세요.
{"primaryEmotion":"...","keywords":["..."],"emotionScore":0-100,"confidence":0-1,"summary":"한 문장"}
원문 인용·진단·처방 금지.`),
        },
        {
          role: "user",
          content: `날짜: ${dateKey}\n메시지:\n${todaysUser
            .map((t, i) => `${i + 1}. ${t.slice(0, 200)}`)
            .join("\n")}`,
        },
      ],
    });

    const parsed = extractJsonObject(result.content) as {
      primaryEmotion?: string;
      keywords?: string[];
      emotionScore?: number;
      confidence?: number;
      summary?: string;
    };
    const primary = parsed.primaryEmotion?.trim();
    if (!primary) return { ok: true, refined: false };

    const record: EmotionAnalysisRecord = {
      id: `em-batch-${dateKey}`,
      userId,
      source: "chat",
      sourceRef: "batch-refine",
      primaryEmotion: primary.slice(0, 20),
      keywords: (parsed.keywords ?? []).map(String).slice(0, 5),
      emotionScore: Math.max(
        0,
        Math.min(100, Math.round(Number(parsed.emotionScore) || 55))
      ),
      confidence: Math.max(
        0,
        Math.min(1, Number(parsed.confidence) || 0.75)
      ),
      summary: (parsed.summary?.trim() || `${primary} 기운이 느껴져요.`).slice(
        0,
        120
      ),
      dateKey,
      createdAt: new Date().toISOString(),
    };
    await appendEmotionRecord(record);
    return { ok: true, refined: true };
  } catch (error) {
    console.warn("[batch.emotion] refine failed", userId, error);
    return { ok: false, refined: false };
  }
}
