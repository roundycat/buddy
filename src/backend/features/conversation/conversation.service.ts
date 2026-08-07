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
  fillNamePlaceholdersDeep,
  resolveModelForPurpose,
  streamCompanionChat,
} from "@/backend/ai/orchestrator";
import { getChildName } from "@/backend/features/persona/persona.store";
import { env } from "@/backend/shared/config/env";
import { logObservation, newRequestId } from "@/backend/shared/observability";
import { detectCrisisSignal } from "@/backend/ai/safety/crisis-detect";
import { CRISIS_TURN_SYSTEM_ADDENDUM } from "@/backend/ai/prompts/safety";
import { createChildSafetyAlert } from "@/backend/features/safety/safety-alert.store";

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

function scheduleCrisisAlert(params: {
  userId: string;
  summary: string;
  level: "elevated" | "urgent";
}) {
  void createChildSafetyAlert({
    childUserId: params.userId,
    summary: params.summary,
    level: params.level,
  }).catch((error) => {
    console.error("[conversation] safety alert failed", error);
  });
}

export async function sendMessage(
  request: SendMessageRequest
): Promise<SendMessageResponse> {
  const userId = request.userId;
  const ctx = await resolveChildCompanionContext(userId, request.message);
  const crisis = detectCrisisSignal(request.message);

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
    ctx.companion,
    crisis.detected ? { systemAddendum: CRISIS_TURN_SYSTEM_ADDENDUM } : undefined
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
    if (crisis.detected && crisis.level !== "none") {
      scheduleCrisisAlert({
        userId,
        summary: crisis.parentSummary,
        level: crisis.level,
      });
    }
  }

  return {
    reply,
    ...(crisis.detected
      ? {
          crisis: {
            level: crisis.level,
            empathyHint: crisis.childEmpathyHint,
            actions: crisis.actions,
          },
        }
      : {}),
  };
}

/**
 * Stream assistant tokens; yields `done` before persist/analysis so the
 * child input unlocks immediately (ECS keeps the process alive afterward).
 */
export async function* streamMessage(
  request: SendMessageRequest
): AsyncGenerator<
  | { type: "crisis"; level: string; empathyHint: string; actions: unknown }
  | { type: "token"; text: string }
  | { type: "done"; reply: ConversationMessage },
  void,
  unknown
> {
  const userId = request.userId;
  const requestId = newRequestId();
  const ctxStarted = Date.now();
  const ctx = await resolveChildCompanionContext(userId, request.message);
  const crisis = detectCrisisSignal(request.message);
  const ctxMs = Date.now() - ctxStarted;
  logObservation({
    feature: "conversation.context",
    operation: "resolve",
    latencyMs: ctxMs,
    success: true,
    requestId,
  });

  if (crisis.detected) {
    yield {
      type: "crisis",
      level: crisis.level,
      empathyHint: crisis.childEmpathyHint,
      actions: crisis.actions,
    };
  }

  const clientHistory = (request.history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  const historyForLlm =
    ctx.storedHistory.length > 0
      ? ctx.storedHistory.map(({ role, content }) => ({ role, content }))
      : clientHistory;

  const chatModel = resolveModelForPurpose("chat");
  let full = "";

  for await (const token of streamCompanionChat(
    request.message,
    historyForLlm,
    ctx.companion,
    crisis.detected ? { systemAddendum: CRISIS_TURN_SYSTEM_ADDENDUM } : undefined
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
    if (crisis.detected && crisis.level !== "none") {
      scheduleCrisisAlert({
        userId,
        summary: crisis.parentSummary,
        level: crisis.level,
      });
    }
  }
}

export async function listConversation(userId: string) {
  const [messages, memory, childName] = await Promise.all([
    getConversationHistory(userId),
    getConversationMemory(userId),
    getChildName(userId),
  ]);

  // Replies stored before placeholder scrubbing existed are still on disk.
  return {
    messages: fillNamePlaceholdersDeep(messages, childName),
    memory,
  };
}
