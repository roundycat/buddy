import { runLlm } from "@/backend/ai/orchestrator";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { env } from "@/backend/shared/config/env";
import type { ConversationMessage } from "./conversation.types";
import {
  getConversationMemory,
  saveConversationMemory,
} from "./conversation.store";
import type { ConversationMemory } from "./memory.types";

/**
 * Learn from each chat turn to refine tone / empathy for this user.
 *
 * TODO [AWS Bedrock]: Same extraction via Converse; persist to DynamoDB
 */

interface MemoryUpdatePayload {
  speechStyleNotes?: string;
  preferredToneNotes?: string[];
  emotionalThemes?: string[];
  importantFacts?: string[];
}

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
  userMessage: string,
  assistantMessage: string
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
    updatedAt: new Date().toISOString(),
  };
}

async function llmUpdate(
  memory: ConversationMemory,
  userMessage: string,
  assistantMessage: string,
  profileSummary: string
): Promise<ConversationMemory | null> {
  if (env.llmProvider === "mock") return null;

  try {
    const result = await runLlm({
      feature: "conversation.memory",
      purpose: "analysis",
      temperature: 0.2,
      maxTokens: 350,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 대화 메모리 추출기입니다. 사용자의 페르소나 맞춤 챗봇이 다음 대화에서 더 잘 공감하도록, 최신 한 턴에서 배울 점만 JSON으로 요약하세요.
반드시 JSON만 출력하세요. 키:
{
  "speechStyleNotes": "string",
  "preferredToneNotes": ["string"],
  "emotionalThemes": ["string"],
  "importantFacts": ["string"]
}
불확실하면 빈 배열/빈 문자열을 쓰세요.`),
        },
        {
          role: "user",
          content: `기존 메모리:
${JSON.stringify(memory, null, 2)}

사용자(상대)와 Beddy 캐릭터 요약:
${profileSummary}

최신 사용자 메시지:
${userMessage}

어시스턴트 응답:
${assistantMessage}

이 턴에서 갱신할 메모리만 JSON으로.`,
        },
      ],
    });

    const raw = result.content.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as MemoryUpdatePayload;

    return {
      ...memory,
      turnCount: memory.turnCount + 1,
      speechStyleNotes:
        parsed.speechStyleNotes?.trim() || memory.speechStyleNotes,
      preferredToneNotes: uniquePush(
        memory.preferredToneNotes,
        parsed.preferredToneNotes ?? []
      ),
      emotionalThemes: uniquePush(
        memory.emotionalThemes,
        parsed.emotionalThemes ?? []
      ),
      importantFacts: uniquePush(
        memory.importantFacts,
        parsed.importantFacts ?? [],
        12
      ),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("[memory] LLM update failed, using heuristic", error);
    return null;
  }
}

export async function learnFromTurn(params: {
  userId: string;
  userMessage: string;
  assistantMessage: string;
  profileSummary: string;
  recent?: ConversationMessage[];
}): Promise<ConversationMemory> {
  const current = await getConversationMemory(params.userId);

  const fromLlm = await llmUpdate(
    current,
    params.userMessage,
    params.assistantMessage,
    params.profileSummary
  );

  const next =
    fromLlm ??
    heuristicUpdate(current, params.userMessage, params.assistantMessage);

  return saveConversationMemory(next);
}
