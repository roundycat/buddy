import type {
  ConversationMessage,
  SendMessageRequest,
  SendMessageResponse,
} from "./conversation.types";
import {
  appendConversationMessages,
  getConversationHistory,
  getConversationMemory,
} from "./conversation.store";
import { learnFromTurn } from "./memory.service";
import { analyzeChatEmotion } from "@/backend/features/emotion-analysis/emotion.service";
import { resolveChildCompanionContext } from "./child-context.service";
import {
  companionChat,
  resolveModelForPurpose,
  streamCompanionChat,
} from "@/backend/ai/orchestrator";
import { env } from "@/backend/shared/config/env";

/**
 * Conversation Service
 *
 * Persona-grounded chat + continuous learning + emotion analysis.
 * Immediate path: one Bedrock chat call. Persist/analysis run after SSE done.
 */

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
      console.error("[conversation] emotion analysis failed", error);
    }),
  ]);
}

function schedulePersistTurn(params: {
  userId: string;
  userMessage: ConversationMessage;
  reply: ConversationMessage;
  profileSummary: string;
}) {
  void persistTurn(params).catch((error) => {
    console.error("[conversation] persistTurn failed", error);
  });
}

export async function sendMessage(
  request: SendMessageRequest
): Promise<SendMessageResponse> {
  const userId = request.userId;
  const ctx = await resolveChildCompanionContext(userId);

  const clientHistory = (request.history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  const historyForLlm =
    ctx.storedHistory.length > 0
      ? ctx.storedHistory.map(({ role, content }) => ({ role, content }))
      : clientHistory;

  const llm = await companionChat(
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
    schedulePersistTurn({
      userId,
      userMessage,
      reply,
      profileSummary: ctx.profileSummary,
    });
  }

  return { reply };
}

/**
 * Stream assistant tokens; yields `done` before persist/analysis so the
 * child input unlocks immediately (ECS keeps the process alive afterward).
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
  const ctxStarted = Date.now();
  const ctx = await resolveChildCompanionContext(userId);
  const ctxMs = Date.now() - ctxStarted;

  const clientHistory = (request.history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  const historyForLlm =
    ctx.storedHistory.length > 0
      ? ctx.storedHistory.map(({ role, content }) => ({ role, content }))
      : clientHistory;

  const chatModel = resolveModelForPurpose("chat");
  let full = "";
  let firstTokenMs: number | null = null;
  const streamStarted = Date.now();

  for await (const token of streamCompanionChat(
    request.message,
    historyForLlm,
    ctx.companion
  )) {
    if (firstTokenMs === null) firstTokenMs = Date.now() - streamStarted;
    full += token;
    yield { type: "token", text: token };
  }

  const streamMs = Date.now() - streamStarted;
  console.info(
    `[conversation:timing] ctxMs=${ctxMs} firstTokenMs=${firstTokenMs ?? -1} streamMs=${streamMs} model=${chatModel}`
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
    content: full.trim() || "응, 여기 있을게.",
    createdAt: new Date().toISOString(),
    meta: {
      provider: env.llmProvider,
      model: chatModel,
    },
  };

  // Unlock the child UI before memory/emotion LLM work.
  yield { type: "done", reply };

  if (userId) {
    schedulePersistTurn({
      userId,
      userMessage,
      reply,
      profileSummary: ctx.profileSummary,
    });
  }
}

export async function listConversation(userId: string) {
  return {
    messages: await getConversationHistory(userId),
    memory: await getConversationMemory(userId),
  };
}
