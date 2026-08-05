import type { ConversationMessage } from "./conversation.types";
import {
  createEmptyMemory,
  type ConversationMemory,
} from "./memory.types";
import { createMapStore } from "@/backend/shared/persist/map-store";

/**
 * Conversation + learning stores.
 * TODO [AWS DynamoDB]: already supported via PERSISTENCE=dynamodb
 */

interface MessageBag {
  userId: string;
  messages: ConversationMessage[];
}

const messages = createMapStore<MessageBag>("conversations.json");
const memories = createMapStore<ConversationMemory>("memories.json");

const MAX_STORED_MESSAGES = 80;

export async function getConversationHistory(
  userId: string
): Promise<ConversationMessage[]> {
  return [...((await messages.get(userId))?.messages ?? [])];
}

export async function appendConversationMessages(
  userId: string,
  nextMessages: ConversationMessage[]
) {
  const current = (await messages.get(userId))?.messages ?? [];
  const next = [...current, ...nextMessages].slice(-MAX_STORED_MESSAGES);
  await messages.set(userId, { userId, messages: next });
  return next;
}

export async function getConversationMemory(
  userId: string
): Promise<ConversationMemory> {
  return (await memories.get(userId)) ?? createEmptyMemory(userId);
}

export async function saveConversationMemory(memory: ConversationMemory) {
  return memories.set(memory.userId, memory);
}

export async function clearConversationForUser(userId: string) {
  await messages.delete(userId);
  await memories.delete(userId);
}

export function formatMemoryForPrompt(memory: ConversationMemory): string {
  if (memory.turnCount === 0) {
    return "아직 대화 학습 메모리가 없습니다. 온보딩 페르소나를 우선 따르세요.";
  }

  const lines = [
    `- 대화 턴 수: ${memory.turnCount}`,
    memory.speechStyleNotes && `- 학습된 어투/속도: ${memory.speechStyleNotes}`,
    memory.preferredToneNotes.length > 0 &&
      `- 선호 톤: ${memory.preferredToneNotes.join("; ")}`,
    memory.emotionalThemes.length > 0 &&
      `- 반복되는 감정 테마: ${memory.emotionalThemes.join(", ")}`,
    memory.importantFacts.length > 0 &&
      `- 기억할 사실: ${memory.importantFacts.join("; ")}`,
  ].filter(Boolean);

  return lines.join("\n");
}
