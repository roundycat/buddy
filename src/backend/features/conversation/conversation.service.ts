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
import {
  assessChildMessage,
  planSafetyResponse,
  type SafetyAssessment,
  type SafetyResponsePlan,
} from "@/backend/ai/safety/v2";
import {
  mergeReviewedLevel,
  reviewWithLlm,
  shouldReview,
} from "@/backend/ai/safety/v2/llm-review";
import { recordSafetySignal } from "@/backend/ai/safety/v2/signal-log.store";
import { guardCompanionReply, rhythmAddendum } from "@/backend/ai/safety/v2/relationship";
import { createChildSafetyAlert } from "@/backend/features/safety/safety-alert.store";
import { recordCount } from "@/backend/shared/observability";

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

/** The child's last few messages — context for the safety layer. */
function recentChildMessages(
  history: Array<{ role: string; content: string }>,
  max = 3
): string[] {
  return history
    .filter((m) => m.role === "user" && m.content?.trim())
    .slice(-max)
    .map((m) => m.content);
}

export interface ChildSafetyCheck {
  assessment: SafetyAssessment;
  plan: SafetyResponsePlan;
}

function checkChildSafety(message: string, context: string[]): ChildSafetyCheck {
  const assessment = assessChildMessage({ text: message, context });
  return { assessment, plan: planSafetyResponse(assessment) };
}

/** Safety guidance first; rhythm nudges only when there is no safety signal. */
function turnAddendum(
  check: ChildSafetyCheck,
  history: Array<{ role: string; createdAt?: string }>
): { systemAddendum: string } | undefined {
  const parts: string[] = [];
  if (check.plan.systemAddendum) parts.push(check.plan.systemAddendum);
  if (check.assessment.level === "none") {
    const rhythm = rhythmAddendum({ history });
    if (rhythm) parts.push(rhythm);
  }
  return parts.length ? { systemAddendum: parts.join("\n\n") } : undefined;
}

/** Drop exclusivity / secrecy / romance sentences from the AI reply. */
function guardReply(text: string): string {
  const guarded = guardCompanionReply(text);
  if (guarded.violations.length) {
    recordCount("RelationshipGuard", 1, {
      feature: "safety",
      operation: guarded.violations.join(","),
    });
  }
  return guarded.text;
}

function crisisEvent(plan: SafetyResponsePlan) {
  return {
    type: "crisis" as const,
    level: plan.level,
    empathyHint: plan.empathyHint,
    guidance: plan.guidance,
    transparency: plan.transparency,
    actions: plan.actions,
  };
}

/**
 * After the reply: minimal guardian alert (alert levels only), signal log
 * (levels and categories, never text), and metrics.
 */
function scheduleSafetyFollowUp(params: {
  userId: string;
  check: ChildSafetyCheck;
}) {
  const { assessment, plan } = params.check;
  recordCount("SafetySignal", 1, {
    feature: "safety",
    operation: assessment.level,
  });
  if (assessment.level === "none") return;
  logObservation({
    feature: "safety.signal",
    operation: assessment.level,
    success: true,
    message: `rules=${assessment.rules.join(",")} sup=${assessment.suppressors.join(",")}`,
  });
  void (async () => {
    if (plan.guardianAlert) {
      await createChildSafetyAlert({
        childUserId: params.userId,
        summary: plan.guardianAlert.summary,
        level: plan.guardianAlert.level,
      });
    }
    await recordSafetySignal(params.userId, assessment);
  })().catch((error) => {
    console.error("[conversation] safety follow-up failed", error);
  });
}

export async function sendMessage(
  request: SendMessageRequest
): Promise<SendMessageResponse> {
  const userId = request.userId;
  const ctx = await resolveChildCompanionContext(userId, request.message);

  const clientHistory = (request.history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  const historyForLlm =
    ctx.storedHistory.length > 0
      ? ctx.storedHistory.map(({ role, content }) => ({ role, content }))
      : clientHistory;

  const safety = checkChildSafety(request.message, recentChildMessages(historyForLlm));

  const llm = await companionChat(
    request.message,
    historyForLlm,
    ctx.companion,
    turnAddendum(safety, ctx.storedHistory)
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
    content: guardReply(llm.content),
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
    scheduleSafetyFollowUp({ userId, check: safety });
  }

  if (!safety.plan.showPanel) return { reply };
  const { type: _type, ...crisis } = crisisEvent(safety.plan);
  return { reply, crisis };
}

/**
 * Stream assistant tokens; yields `done` before persist/analysis so the
 * child input unlocks immediately (ECS keeps the process alive afterward).
 */
export async function* streamMessage(
  request: SendMessageRequest
): AsyncGenerator<
  | ReturnType<typeof crisisEvent>
  | { type: "token"; text: string }
  | { type: "done"; reply: ConversationMessage },
  void,
  unknown
> {
  const userId = request.userId;
  const requestId = newRequestId();
  const ctxStarted = Date.now();
  const ctx = await resolveChildCompanionContext(userId, request.message);
  const ctxMs = Date.now() - ctxStarted;
  logObservation({
    feature: "conversation.context",
    operation: "resolve",
    latencyMs: ctxMs,
    success: true,
    requestId,
  });

  const clientHistory = (request.history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  const historyForLlm =
    ctx.storedHistory.length > 0
      ? ctx.storedHistory.map(({ role, content }) => ({ role, content }))
      : clientHistory;

  const childContext = recentChildMessages(historyForLlm);
  let safety = checkChildSafety(request.message, childContext);

  if (safety.plan.showPanel) {
    yield crisisEvent(safety.plan);
  }

  // Ambiguous messages get a second look while the reply streams (raise-only).
  const review = shouldReview(safety.assessment)
    ? reviewWithLlm({ text: request.message, context: childContext })
    : null;

  const chatModel = resolveModelForPurpose("chat");
  let full = "";

  for await (const token of streamCompanionChat(
    request.message,
    historyForLlm,
    ctx.companion,
    turnAddendum(safety, ctx.storedHistory)
  )) {
    full += token;
    yield { type: "token", text: token };
  }

  if (review) {
    const reviewed = await review;
    const merged = mergeReviewedLevel(safety.assessment.level, reviewed);
    if (merged !== safety.assessment.level) {
      const assessment: SafetyAssessment = {
        ...safety.assessment,
        level: merged,
        rules: [...safety.assessment.rules, "llm_review"],
      };
      const plan = planSafetyResponse(assessment);
      if (plan.showPanel && !safety.plan.showPanel) {
        yield crisisEvent(plan);
      }
      safety = { assessment, plan };
    }
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
    content: guardReply(full.trim()) || "응, 여기 있을게.",
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
    scheduleSafetyFollowUp({ userId, check: safety });
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
