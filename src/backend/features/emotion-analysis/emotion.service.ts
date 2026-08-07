import { runLlm } from "@/backend/ai/orchestrator";
import { env } from "@/backend/shared/config/env";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";
import { todayKey } from "@/backend/shared/time/date";
import {
  appendEmotionRecord,
  listEmotionRecords,
} from "./emotion.store";
import type {
  EmotionAnalysisRecord,
  EmotionDayAggregate,
} from "./emotion.types";

function clampScore(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function clampConfidence(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, Math.round(v * 100) / 100));
}

function heuristicFromText(text: string): Omit<
  EmotionAnalysisRecord,
  "id" | "userId" | "source" | "sourceRef" | "dateKey" | "createdAt"
> {
  const lower = text.toLowerCase();
  if (/불안|초조|걱정|무서/.test(lower)) {
    return {
      primaryEmotion: "불안",
      keywords: ["불안", "걱정"],
      emotionScore: 35,
      confidence: 0.55,
      summary: "걱정·긴장 기운이 느껴져요.",
    };
  }
  if (/피곤|지침|졸|힘들/.test(lower)) {
    return {
      primaryEmotion: "피로",
      keywords: ["피로", "지침"],
      emotionScore: 40,
      confidence: 0.5,
      summary: "몸과 마음이 조금 지친 하루예요.",
    };
  }
  if (/외로|혼자|심심/.test(lower)) {
    return {
      primaryEmotion: "외로움",
      keywords: ["외로움"],
      emotionScore: 38,
      confidence: 0.5,
      summary: "혼자인 느낌이 스며 있어요.",
    };
  }
  if (/화|짜증|억울/.test(lower)) {
    return {
      primaryEmotion: "답답함",
      keywords: ["답답함"],
      emotionScore: 42,
      confidence: 0.5,
      summary: "답답하거나 화난 기운이 있어요.",
    };
  }
  if (/희망|괜찮|고마|좋아|행복/.test(lower)) {
    return {
      primaryEmotion: "안도",
      keywords: ["안도", "긍정"],
      emotionScore: 78,
      confidence: 0.55,
      summary: "따뜻한·괜찮은 기운이 있어요.",
    };
  }
  return {
    primaryEmotion: "평온",
    keywords: ["일상"],
    emotionScore: 55,
    confidence: 0.35,
    summary: "특별한 기복 없이 하루를 이어가는 중이에요.",
  };
}

async function llmExtract(userMessage: string): Promise<Omit<
  EmotionAnalysisRecord,
  "id" | "userId" | "source" | "sourceRef" | "dateKey" | "createdAt"
> | null> {
  if (env.llmProvider === "mock") return null;

  try {
    const result = await runLlm({
      feature: "emotion.analysis",
      purpose: "analysis",
      temperature: 0.2,
      maxTokens: 280,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 아동·청소년 돌봄 앱 Beddy의 감정 분석기입니다.
아이 메시지에서 감정만 추출해 JSON만 출력하세요.
{
  "primaryEmotion": "한국어 감정 한 단어",
  "keywords": ["키워드1", "키워드2"],
  "emotionScore": 0-100,
  "confidence": 0-1,
  "summary": "보호자/기록용 한 문장 (원문 인용 금지)"
}
emotionScore: 높을수록 따뜻·안도·긍정 쪽.`),
        },
        {
          role: "user",
          content: `아이 메시지:\n${userMessage.slice(0, 500)}`,
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
    if (!primary) return null;

    return {
      primaryEmotion: primary.slice(0, 20),
      keywords: (parsed.keywords ?? [])
        .map((k) => String(k).trim())
        .filter(Boolean)
        .slice(0, 5),
      emotionScore: clampScore(parsed.emotionScore, 50),
      confidence: clampConfidence(parsed.confidence, 0.5),
      summary: (parsed.summary?.trim() || `${primary} 기운이 느껴져요.`).slice(
        0,
        120
      ),
    };
  } catch (error) {
    console.warn("[emotion] LLM extract failed", error);
    return null;
  }
}

/**
 * Analyze one chat turn and persist structured emotion result.
 *
 * Hot path uses heuristics only (no Bedrock) so chat latency stays low.
 * Nightly batch `emotion-refine.job` may upgrade today's records with one LLM pass.
 */
export async function analyzeChatEmotion(params: {
  userId: string;
  userMessage: string;
  messageId?: string;
  /** When true, allow a Bedrock extract (batch / admin only). */
  allowLlm?: boolean;
}): Promise<EmotionAnalysisRecord> {
  const extracted =
    (params.allowLlm ? await llmExtract(params.userMessage) : null) ??
    heuristicFromText(params.userMessage);

  const record: EmotionAnalysisRecord = {
    id: `em-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: params.userId,
    source: "chat",
    sourceRef: params.messageId,
    primaryEmotion: extracted.primaryEmotion,
    keywords: extracted.keywords,
    emotionScore: extracted.emotionScore,
    confidence: extracted.confidence,
    summary: extracted.summary,
    dateKey: todayKey(),
    createdAt: new Date().toISOString(),
  };

  return appendEmotionRecord(record);
}

export async function recordGardenEmotion(params: {
  userId: string;
  moodLabel: string;
  moodId: string;
}): Promise<EmotionAnalysisRecord> {
  const scoreByMood: Record<string, number> = {
    happy: 82,
    love: 88,
    sleepy: 48,
    sad: 28,
    angry: 36,
  };
  const record: EmotionAnalysisRecord = {
    id: `em-garden-${todayKey()}`,
    userId: params.userId,
    source: "garden",
    sourceRef: params.moodId,
    primaryEmotion: params.moodLabel,
    keywords: [params.moodLabel, "감정정원"],
    emotionScore: scoreByMood[params.moodId] ?? 50,
    confidence: 0.9,
    summary: `오늘 정원에 “${params.moodLabel}” 꽃이 피었어요.`,
    dateKey: todayKey(),
    createdAt: new Date().toISOString(),
  };
  return appendEmotionRecord(record);
}

export async function aggregateEmotionsByDay(
  userId: string,
  limitDays = 14
): Promise<EmotionDayAggregate[]> {
  const records = await listEmotionRecords(userId);
  const byDay = new Map<string, EmotionAnalysisRecord[]>();
  for (const r of records) {
    const list = byDay.get(r.dateKey) ?? [];
    list.push(r);
    byDay.set(r.dateKey, list);
  }

  return Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, limitDays)
    .map(([dateKey, list]) => {
      const avgScore =
        list.reduce((s, r) => s + r.emotionScore, 0) / Math.max(1, list.length);
      const avgConf =
        list.reduce((s, r) => s + r.confidence, 0) / Math.max(1, list.length);
      const keywordCount = new Map<string, number>();
      const emotionCount = new Map<string, number>();
      for (const r of list) {
        emotionCount.set(
          r.primaryEmotion,
          (emotionCount.get(r.primaryEmotion) ?? 0) + 1
        );
        for (const k of r.keywords) {
          keywordCount.set(k, (keywordCount.get(k) ?? 0) + 1);
        }
      }
      const primaryEmotion =
        Array.from(emotionCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
        "평온";
      const keywords = Array.from(keywordCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k]) => k);

      return {
        dateKey,
        primaryEmotion,
        keywords,
        averageScore: Math.round(avgScore),
        averageConfidence: Math.round(avgConf * 100) / 100,
        sampleCount: list.length,
      };
    });
}

export async function latestEmotionSummary(
  userId: string
): Promise<EmotionAnalysisRecord | null> {
  const records = await listEmotionRecords(userId);
  return records[records.length - 1] ?? null;
}
