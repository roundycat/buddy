import "server-only";
import { runLlm } from "@/backend/ai/llm-gateway";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { env } from "@/backend/shared/config/env";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";
import { todayKey } from "@/backend/shared/time/date";
import {
  getConversationHistory,
  getConversationMemory,
  saveConversationMemory,
} from "@/backend/features/conversation/conversation.store";
import type {
  ConversationMemory,
  PersistentFact,
} from "@/backend/features/conversation/memory.types";
import {
  formatCompanionCharacterForPrompt,
  formatSelfForPrompt,
  getPersonaForUser,
} from "@/backend/features/persona/persona.store";

/**
 * Job 1 — Nightly memory consolidation (Opus / quality).
 * Replaces per-turn LLM memory extraction.
 */
export async function consolidateMemoryForUser(
  userId: string,
  dateKey = todayKey()
): Promise<{ userId: string; ok: boolean; factCount: number }> {
  const [memory, history, persona] = await Promise.all([
    getConversationMemory(userId),
    getConversationHistory(userId),
    getPersonaForUser(userId),
  ]);

  if (history.length === 0) {
    return { userId, ok: true, factCount: memory.persistentFacts?.length ?? 0 };
  }

  const dayMessages = history.filter((m) => m.createdAt.startsWith(dateKey));
  const window = (dayMessages.length ? dayMessages : history.slice(-24)).map(
    (m) => `${m.role}: ${m.content}`
  );

  if (env.llmProvider === "mock") {
    const next = heuristicConsolidate(memory, dateKey);
    await saveConversationMemory(next);
    return {
      userId,
      ok: true,
      factCount: next.persistentFacts?.length ?? 0,
    };
  }

  const profile = [
    formatCompanionCharacterForPrompt(persona),
    formatSelfForPrompt(persona?.self),
  ].join("\n\n");

  try {
    const result = await runLlm({
      feature: "batch.memory-consolidate",
      purpose: "quality",
      temperature: 0.3,
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 Beddy 메모리 통합기입니다.
하루치(또는 최근) 대화를 읽고 메모리를 재작성하세요.
휘발성(어투·감정 테마·톤)은 짧게 갱신하고, 영속 사실만 중요도(1~5)와 함께 남기세요.
원문 대화 인용 금지. JSON만:
{
  "speechStyleNotes": "string",
  "preferredToneNotes": ["string"],
  "emotionalThemes": ["string"],
  "persistentFacts": [{"text":"string","importance":1}]
}`),
        },
        {
          role: "user",
          content: `날짜: ${dateKey}
프로필 요약:
${profile}

기존 메모리:
${JSON.stringify(
  {
    speechStyleNotes: memory.speechStyleNotes,
    preferredToneNotes: memory.preferredToneNotes,
    emotionalThemes: memory.emotionalThemes,
    persistentFacts: memory.persistentFacts ?? [],
    importantFacts: memory.importantFacts,
  },
  null,
  2
)}

대화:
${window.join("\n")}`,
        },
      ],
    });

    const parsed = extractJsonObject(result.content) as {
      speechStyleNotes?: string;
      preferredToneNotes?: string[];
      emotionalThemes?: string[];
      persistentFacts?: Array<{ text?: string; importance?: number }>;
    };

    const now = new Date().toISOString();
    const mergedFacts = mergePersistentFacts(
      memory.persistentFacts ?? legacyToPersistent(memory.importantFacts),
      (parsed.persistentFacts ?? [])
        .map((f) => ({
          text: (f.text ?? "").trim(),
          importance: clampImportance(f.importance),
          updatedAt: now,
        }))
        .filter((f) => f.text.length >= 2)
    );

    const next: ConversationMemory = {
      ...memory,
      speechStyleNotes:
        parsed.speechStyleNotes?.trim() || memory.speechStyleNotes,
      preferredToneNotes: uniqueCap(
        parsed.preferredToneNotes ?? memory.preferredToneNotes,
        8
      ),
      emotionalThemes: uniqueCap(
        parsed.emotionalThemes ?? memory.emotionalThemes,
        8
      ),
      persistentFacts: mergedFacts,
      importantFacts: mergedFacts.map((f) => f.text),
      lastConsolidatedDateKey: dateKey,
      updatedAt: now,
    };
    await saveConversationMemory(next);
    return { userId, ok: true, factCount: mergedFacts.length };
  } catch (error) {
    console.error("[batch.memory]", userId, error);
    return {
      userId,
      ok: false,
      factCount: memory.persistentFacts?.length ?? 0,
    };
  }
}

function heuristicConsolidate(
  memory: ConversationMemory,
  dateKey: string
): ConversationMemory {
  const facts =
    memory.persistentFacts?.length
      ? memory.persistentFacts
      : legacyToPersistent(memory.importantFacts);
  return {
    ...memory,
    persistentFacts: facts,
    importantFacts: facts.map((f) => f.text),
    emotionalThemes: memory.emotionalThemes.slice(-8),
    preferredToneNotes: memory.preferredToneNotes.slice(-8),
    lastConsolidatedDateKey: dateKey,
    updatedAt: new Date().toISOString(),
  };
}

function legacyToPersistent(facts: string[]): PersistentFact[] {
  const now = new Date().toISOString();
  return facts
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ text, importance: 3, updatedAt: now }));
}

function mergePersistentFacts(
  existing: PersistentFact[],
  incoming: PersistentFact[]
): PersistentFact[] {
  const map = new Map<string, PersistentFact>();
  for (const f of existing) {
    map.set(f.text.toLowerCase(), f);
  }
  for (const f of incoming) {
    const key = f.text.toLowerCase();
    const prev = map.get(key);
    if (!prev || f.importance >= prev.importance) {
      map.set(key, f);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.importance - a.importance);
}

function uniqueCap(list: string[], max: number): string[] {
  const out: string[] = [];
  for (const v of list) {
    const c = v.trim();
    if (!c) continue;
    if (!out.some((x) => x.toLowerCase() === c.toLowerCase())) out.push(c);
  }
  return out.slice(-max);
}

function clampImportance(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(5, Math.round(v)));
}
