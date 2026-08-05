import type { ConversationMessage } from "./conversation.types";
import {
  getConversationMemory,
  saveConversationMemory,
} from "./conversation.store";
import type { ConversationMemory } from "./memory.types";

/**
 * Per-turn learning — heuristic only (STEP 4).
 * Nightly batch consolidates with Opus (quality model).
 */

function uniquePush(list: string[], values: string[], max = 8) {
  const next = [...list];
  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned) continue;
    if (!next.some((item) => item.toLowerCase() === cleaned.toLowerCase())) {
      next.push(cleaned);
    }
  }
  return next.slice(-max);
}

function heuristicUpdate(
  memory: ConversationMemory,
  userMessage: string
): ConversationMemory {
  const text = userMessage.toLowerCase();
  const themes: string[] = [];
  if (/불안|초조|걱정|무서/.test(text)) themes.push("불안");
  if (/피곤|지침|졸|힘들/.test(text)) themes.push("피로");
  if (/외로|혼자|심심/.test(text)) themes.push("외로움");
  if (/화|짜증|억울/.test(text)) themes.push("분노/답답함");
  if (/희망|괜찮|고마|좋아/.test(text)) themes.push("안도/긍정");

  const toneNotes: string[] = [];
  if (userMessage.length < 20) {
    toneNotes.push("짧은 메시지에 짧고 담백하게 응답");
  } else if (userMessage.length > 80) {
    toneNotes.push("긴 이야기에는 요지를 반영하며 차분히 응답");
  }
  if (/들어|말|얘기/.test(text)) {
    toneNotes.push("경청과 감정 반영을 우선");
  }

  return {
    ...memory,
    turnCount: memory.turnCount + 1,
    emotionalThemes: uniquePush(memory.emotionalThemes, themes),
    preferredToneNotes: uniquePush(memory.preferredToneNotes, toneNotes),
    speechStyleNotes:
      memory.speechStyleNotes ||
      "사용자의 호흡에 맞춰 존중하는 어투를 유지합니다.",
    importantFacts: memory.importantFacts,
    persistentFacts: memory.persistentFacts ?? [],
    updatedAt: new Date().toISOString(),
  };
}

export async function learnFromTurn(params: {
  userId: string;
  userMessage: string;
  assistantMessage: string;
  profileSummary: string;
  recent?: ConversationMessage[];
}): Promise<ConversationMemory> {
  const current = await getConversationMemory(params.userId);
  const next = heuristicUpdate(current, params.userMessage);
  return saveConversationMemory(next);
}
