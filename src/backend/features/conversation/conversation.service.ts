import type {
  ConversationMessage,
  SendMessageRequest,
  SendMessageResponse,
} from "./conversation.types";
import {
  chatWithCompanion,
  getLlmStatus,
  streamWithCompanion,
} from "@/backend/shared/llm";
import {
  formatCompanionCharacterForPrompt,
  formatSelfForPrompt,
  getPersonaForUser,
} from "@/backend/features/persona/persona.store";
import {
  appendConversationMessages,
  formatMemoryForPrompt,
  getConversationHistory,
  getConversationMemory,
} from "./conversation.store";
import { learnFromTurn } from "./memory.service";
import { formatWishesForPrompt } from "@/backend/features/wish-tree/wish-tree.service";
import { analyzeChatEmotion } from "@/backend/features/emotion-analysis/emotion.service";

/**
 * Conversation Service
 *
 * Persona-grounded chat + continuous learning + emotion analysis.
 */

async function resolveCompanionContext(userId?: string) {
  const persona = userId ? await getPersonaForUser(userId) : undefined;
  const hasPersona = Boolean(persona?.setupCompleted && persona.profile);
  const characterSheet = formatCompanionCharacterForPrompt(persona);
  const selfSummary = formatSelfForPrompt(persona?.self);
  const profileSummary = [characterSheet, selfSummary].join("\n\n");

  const storedHistory = userId ? await getConversationHistory(userId) : [];

  const memory = userId ? await getConversationMemory(userId) : undefined;

  return {
    persona,
    hasPersona,
    characterSheet,
    selfSummary,
    profileSummary,
    storedHistory,
    memory,
    companion: {
      name: persona?.name,
      tone: persona?.tone,
      callName: persona?.callName || "너",
      styleKey: persona?.interaction,
      energyKey: persona?.energy,
      companionVoice: persona?.companionMessage,
      characterSheet,
      selfSummary,
      memorySummary: memory ? formatMemoryForPrompt(memory) : undefined,
      wishSummary: userId ? await formatWishesForPrompt(userId) : undefined,
      hasPersona,
    },
  };
}

async function persistTurn(params: {
  userId: string;
  userMessage: ConversationMessage;
  reply: ConversationMessage;
  profileSummary: string;
}) {
  await appendConversationMessages(params.userId, [
    params.userMessage,
    params.reply,
  ]);

  await Promise.all([
    learnFromTurn({
      userId: params.userId,
      userMessage: params.userMessage.content,
      assistantMessage: params.reply.content,
      profileSummary: params.profileSummary,
      recent: await getConversationHistory(params.userId),
    }),
    analyzeChatEmotion({
      userId: params.userId,
      userMessage: params.userMessage.content,
      messageId: params.userMessage.id,
    }).catch((error) => {
      console.warn("[conversation] emotion analysis skipped", error);
    }),
  ]);
}

export async function sendMessage(
  request: SendMessageRequest
): Promise<SendMessageResponse> {
  const userId = request.userId;
  const ctx = await resolveCompanionContext(userId);

  const clientHistory = (request.history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  const historyForLlm =
    ctx.storedHistory.length > 0
      ? ctx.storedHistory.map(({ role, content }) => ({ role, content }))
      : clientHistory;

  const llm = await chatWithCompanion(
    request.message,
    historyForLlm,
    ctx.companion
  );

  const now = new Date().toISOString();
  const userMessage: ConversationMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content: request.message,
    createdAt: now,
  };

  const reply: ConversationMessage = {
    id: `msg-${Date.now()}`,
    role: "assistant",
    content: llm.content,
    createdAt: new Date().toISOString(),
    meta: {
      provider: llm.provider,
      model: llm.model,
    },
  };

  if (userId) {
    await persistTurn({
      userId,
      userMessage,
      reply,
      profileSummary: ctx.profileSummary,
    });
  }

  return { reply };
}

/**
 * Stream assistant tokens; persists full reply when the stream ends.
 */
export async function* streamMessage(
  request: SendMessageRequest
): AsyncGenerator<
  | { type: "token"; text: string }
  | { type: "done"; reply: ConversationMessage },
  void,
  unknown
> {
  const userId = request.userId;
  const ctx = await resolveCompanionContext(userId);

  const clientHistory = (request.history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  const historyForLlm =
    ctx.storedHistory.length > 0
      ? ctx.storedHistory.map(({ role, content }) => ({ role, content }))
      : clientHistory;

  const status = getLlmStatus();
  let full = "";

  for await (const token of streamWithCompanion(
    request.message,
    historyForLlm,
    ctx.companion
  )) {
    full += token;
    yield { type: "token", text: token };
  }

  const now = new Date().toISOString();
  const userMessage: ConversationMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content: request.message,
    createdAt: now,
  };

  const reply: ConversationMessage = {
    id: `msg-${Date.now()}`,
    role: "assistant",
    content: full.trim() || "응, 여기 있을게.",
    createdAt: new Date().toISOString(),
    meta: {
      provider: status.provider,
      model: status.model,
    },
  };

  if (userId) {
    await persistTurn({
      userId,
      userMessage,
      reply,
      profileSummary: ctx.profileSummary,
    });
  }

  yield { type: "done", reply };
}

export async function listConversation(userId: string) {
  return {
    messages: await getConversationHistory(userId),
    memory: await getConversationMemory(userId),
  };
}
