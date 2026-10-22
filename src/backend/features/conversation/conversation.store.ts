import type { ConversationMessage } from "./conversation.types";
import {
  allFactTexts,
  createEmptyMemory,
  type ConversationMemory,
  type PersistentFact,
} from "./memory.types";
import { createMapStore } from "@/backend/shared/persist/map-store";

/**
 * Conversation + learning stores.
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

/**
 * Messages that may be sent to a model again — a declined turn (both sides) is
 * dropped so it does not make the following turns decline too.
 */
export function forModelContext(messages: ConversationMessage[]): ConversationMessage[] {
  return messages.filter((m) => !m.meta?.refused);
}

/**
 * Messages that may go into records that outlive the chat — learned memory,
 * emotion records and the summaries a guardian can read. Declined turns and
 * turns about harm by someone are left out: the guardian may be that person.
 */
export function forLongTermRecords(messages: ConversationMessage[]): ConversationMessage[] {
  return messages.filter((m) => !m.meta?.refused && !m.meta?.protect);
}

/** One child's writes run one after another (read-modify-write must not interleave). */
const writeChains = new Map<string, Promise<unknown>>();

function serialized<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const previous = writeChains.get(userId) ?? Promise.resolve();
  const run = previous.then(task, task);
  const settled = run.then(
    () => undefined,
    () => undefined
  );
  writeChains.set(userId, settled);
  void settled.then(() => {
    if (writeChains.get(userId) === settled) writeChains.delete(userId);
  });
  return run;
}

/**
 * Append messages in time order. A turn saved late (the child left mid-reply
 * and the safety review was still settling) still lands where it happened.
 */
export function appendConversationMessages(
  userId: string,
  nextMessages: ConversationMessage[]
) {
  return serialized(userId, async () => {
    const current = (await messages.get(userId))?.messages ?? [];
    const next = [...current, ...nextMessages]
      .map((message, index) => ({ message, index }))
      .sort((a, b) => a.message.createdAt.localeCompare(b.message.createdAt) || a.index - b.index)
      .map(({ message }) => message)
      .slice(-MAX_STORED_MESSAGES);
    await messages.set(userId, { userId, messages: next });
    return next;
  });
}

export async function getConversationMemory(
  userId: string
): Promise<ConversationMemory> {
  const row = (await memories.get(userId)) ?? createEmptyMemory(userId);
  if (!row.persistentFacts) row.persistentFacts = [];
  return row;
}

export async function saveConversationMemory(memory: ConversationMemory) {
  return memories.set(memory.userId, memory);
}

export async function listMemoryUserIds(): Promise<string[]> {
  const entries = await memories.entries();
  return entries.map(([id]) => id);
}

export async function clearConversationForUser(userId: string) {
  await messages.delete(userId);
  await memories.delete(userId);
}

/**
 * Inject only keyword-overlap + recent/important top N facts (STEP 4).
 */
export function formatMemoryForPrompt(
  memory: ConversationMemory,
  currentMessage?: string
): string {
  if (memory.turnCount === 0) {
    return "아직 대화 학습 메모리가 없습니다. 온보딩 페르소나를 우선 따르세요.";
  }

  const facts = selectFactsForContext(memory, currentMessage, 6);
  const lines = [
    `- 대화 턴 수: ${memory.turnCount}`,
    memory.speechStyleNotes && `- 학습된 어투/속도: ${memory.speechStyleNotes}`,
    memory.preferredToneNotes.length > 0 &&
      `- 선호 톤: ${memory.preferredToneNotes.slice(-4).join("; ")}`,
    memory.emotionalThemes.length > 0 &&
      `- 반복되는 감정 테마: ${memory.emotionalThemes.slice(-6).join(", ")}`,
    facts.length > 0 && `- 기억할 사실: ${facts.join("; ")}`,
  ].filter(Boolean);

  return lines.join("\n");
}

function selectFactsForContext(
  memory: ConversationMemory,
  currentMessage: string | undefined,
  limit: number
): string[] {
  const persistent = [...(memory.persistentFacts ?? [])];
  if (persistent.length === 0) {
    return allFactTexts(memory).slice(-limit);
  }

  const tokens = tokenize(currentMessage ?? "");
  const scored = persistent.map((f) => ({
    f,
    score:
      f.importance * 2 +
      overlapScore(tokens, f.text) * 3 +
      recencyBonus(f.updatedAt),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.f.text);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^0-9a-zA-Z가-힣]+/)
    .filter((t) => t.length >= 2);
}

function overlapScore(tokens: string[], fact: string): number {
  if (!tokens.length) return 0;
  const lower = fact.toLowerCase();
  let n = 0;
  for (const t of tokens) {
    if (lower.includes(t)) n += 1;
  }
  return n;
}

function recencyBonus(iso: string): number {
  const ageMs = Date.now() - new Date(iso).getTime();
  const days = ageMs / (24 * 60 * 60 * 1000);
  if (days < 2) return 3;
  if (days < 7) return 2;
  if (days < 30) return 1;
  return 0;
}

export type { PersistentFact };
