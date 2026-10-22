import type {
  ConversationMessage,
  SendMessageRequest,
  SendMessageResponse,
} from "./conversation.types";
import {
  appendConversationMessages,
  forLongTermRecords,
  forModelContext,
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
  mergeReviewedAssessment,
  REVIEW_GRACE_MS,
  REVIEW_MIN_WINDOW_MS,
  REVIEW_TIMEOUT_MS,
  reviewWithLlm,
  shouldReview,
} from "@/backend/ai/safety/v2/llm-review";
import {
  hadRecentAbuseDisclosure,
  recordSafetySignal,
} from "@/backend/ai/safety/v2/signal-log.store";
import { rhythmAddendum } from "@/backend/ai/safety/v2/relationship";
import {
  createOutputGuardStream,
  guardCompanionOutput,
  type OutputFlag,
} from "@/backend/ai/safety/v2/output-guard";
import { createChildSafetyAlert } from "@/backend/features/safety/safety-alert.store";
import { decideShare } from "@/backend/features/sharing/share-policy";
import {
  DEFAULT_CONCERN_SUMMARY,
  requestChildConsentForConcern,
} from "@/backend/features/sharing/concern-request.service";
import type { SafetyLevel, SignalCategory } from "@/backend/ai/safety/v2/types";
import { recordCount } from "@/backend/shared/observability";
import { isChildConsentPending } from "@/backend/features/consent/consent.guard";
import { isRefusalReply, REFUSAL_FALLBACK_TEXT } from "@/backend/shared/llm/refusal";

/**
 * Conversation Service
 *
 * Persona-grounded chat + continuous learning + emotion analysis.
 * Immediate path: one chat call. The safety layer's writes (guardian alert,
 * signal log) start before the reply streams; the turn is saved when the reply
 * ends or when the child leaves mid-reply.
 */

type TurnParams = {
  userId: string;
  userMessage: ConversationMessage;
  reply: ConversationMessage;
  profileSummary: string;
  /** The chat model declined this turn — keep it for the child, out of model context. */
  refused?: boolean;
  /** Harm by someone told now or in the last 72 hours — out of guardian-visible records. */
  protect?: boolean;
};

async function persistTurn(params: TurnParams) {
  // Consent may have been withdrawn (and the records erased) while this turn
  // was streaming: then nothing of it is written back.
  if (await isChildConsentPending(params.userId)) return;
  const mark = (m: ConversationMessage): ConversationMessage =>
    params.refused || params.protect
      ? {
          ...m,
          meta: {
            ...m.meta,
            ...(params.refused ? { refused: true } : {}),
            ...(params.protect ? { protect: true } : {}),
          },
        }
      : m;
  await appendConversationMessages(params.userId, [
    mark(params.userMessage),
    mark(params.reply),
  ]);
  // A declined turn is not learned from or analysed: both would send it to a model again.
  // A turn about harm by someone stays out of memory and emotion records, which
  // feed what the guardian reads.
  if (params.refused || params.protect) return;

  await Promise.all([
    learnFromTurn({
      userId: params.userId,
      userMessage: params.userMessage.content,
      assistantMessage: params.reply.content,
      profileSummary: params.profileSummary,
      recent: forLongTermRecords(await getConversationHistory(params.userId)),
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

function schedulePersistTurn(params: TurnParams) {
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

/** The child told of harm by someone (alone, or with a death wish). */
function toldOfHarm(assessment: SafetyAssessment): boolean {
  return assessment.abuse || assessment.level === "protect";
}

export interface ChildSafetyCheck {
  assessment: SafetyAssessment;
  plan: SafetyResponsePlan;
}

function checkChildSafety(
  message: string,
  context: string[],
  priorAbuse = false
): ChildSafetyCheck {
  const assessment = assessChildMessage({ text: message, context, priorAbuse });
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

function recordOutputFlags(flags: OutputFlag[]) {
  if (!flags.length) return;
  recordCount("OutputGuard", 1, {
    feature: "safety",
    operation: flags.slice().sort().join(","),
  });
}

/**
 * Sentence-level output filter: personal data, medication instructions, method
 * instructions, and relationship rules (exclusivity, secrecy, romance, "I'm human").
 */
function guardReply(text: string): string {
  const guarded = guardCompanionOutput(text);
  recordOutputFlags(guarded.flags);
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
 * Everything the safety layer writes for one turn, with its final level:
 * minimal guardian alert (alert levels, no harm by someone), signal log
 * (levels and categories, never text), and the child-first concern request.
 * Runs once per turn and does not depend on the child staying on the page.
 */
function recordSafetyOutcome(userId: string | undefined, check: ChildSafetyCheck) {
  const { assessment, plan } = check;
  recordCount("SafetySignal", 1, {
    feature: "safety",
    operation: assessment.level,
  });
  if (assessment.level === "none") return;
  logObservation({
    feature: "safety.signal",
    operation: assessment.level,
    success: true,
    message: `rules=${assessment.rules.join(",")} sup=${assessment.suppressors.join(",")} abuse=${assessment.abuse}`,
  });
  if (!userId) return;
  void (async () => {
    // Consent withdrawn (and records erased) while this turn ran: write nothing.
    // The child still saw the help panel; a pending child has no guardian view.
    if (await isChildConsentPending(userId)) return;
    // The share policy is the single place that decides what reaches a guardian:
    // urgent/elevated → minimal alert; protect, or harm by someone → hospital route.
    const share = decideShare({
      kind: "safety",
      crisisLevel: assessment.level,
      abuse: assessment.abuse,
    });
    if (share.decision === "minimal" && plan.guardianAlert) {
      await createChildSafetyAlert({
        childUserId: userId,
        summary: plan.guardianAlert.summary,
        level: plan.guardianAlert.level,
      });
    }
    const signal = await recordSafetySignal(userId, assessment);
    // Watch signals keep coming back → ask the child before anyone is told.
    if (
      signal.persistentDistress &&
      decideShare({ kind: "concern", persistentDistress: true }).decision === "ask_child"
    ) {
      await requestChildConsentForConcern(userId, concernSummary(assessment.categories));
      recordCount("ConcernConsentRequests", 1, { feature: "safety", operation: "ask_child" });
    }
  })().catch((error) => {
    console.error("[conversation] safety follow-up failed", error);
  });
}

function applyReview(rules: ChildSafetyCheck, reviewed: SafetyLevel | null): ChildSafetyCheck {
  const assessment = mergeReviewedAssessment(rules.assessment, reviewed);
  return assessment === rules.assessment
    ? rules
    : { assessment, plan: planSafetyResponse(assessment) };
}

const LATE = Symbol("review-late");

/**
 * The review counts if it arrives before the reply ends plus a short grace, and
 * never gets less than REVIEW_MIN_WINDOW_MS from the start (the admin
 * evaluation measures with that same minimum). A later result is dropped, so
 * nothing is sent to a guardian that the child was not shown.
 */
async function withinReviewWindow(
  review: Promise<SafetyLevel | null>,
  startedAt: number
): Promise<SafetyLevel | null> {
  const waitMs = Math.max(REVIEW_GRACE_MS, REVIEW_MIN_WINDOW_MS - (Date.now() - startedAt));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<typeof LATE>((resolve) => {
    timer = setTimeout(() => resolve(LATE), waitMs);
  });
  const result = await Promise.race([review, late]);
  clearTimeout(timer);
  if (result === LATE) {
    logObservation({ feature: "safety.review", operation: "late", success: false, latencyMs: Date.now() - startedAt });
    return null;
  }
  return result;
}

/**
 * Safety for one turn. Without a review the rules' level is final, so the
 * outcome is written right away — before any reply token streams. With a review,
 * `settle()` decides once (after the reply, or when the child leaves) and writes it.
 */
function startTurnSafety(
  userId: string | undefined,
  message: string,
  context: string[],
  priorAbuse = false
): { rules: ChildSafetyCheck; settle: () => Promise<ChildSafetyCheck> } {
  const startedAt = Date.now();
  const rules = checkChildSafety(message, context, priorAbuse);
  const review = shouldReview(rules.assessment)
    ? reviewWithLlm({ text: message, context })
    : null;
  let final: Promise<ChildSafetyCheck> | null = null;
  const settle = () =>
    (final ??= (async () => {
      // A failed review leaves the rules' reading (raise-only: nothing is lost).
      const reviewed = review
        ? await withinReviewWindow(review.catch(() => null), startedAt)
        : null;
      const check = review ? applyReview(rules, reviewed) : rules;
      recordSafetyOutcome(userId, check);
      return check;
    })());
  if (!review) {
    void settle();
  } else {
    // Backstop if a caller never reaches settle() (settle runs once either way).
    const backstop = setTimeout(() => void settle(), REVIEW_TIMEOUT_MS + REVIEW_GRACE_MS);
    backstop.unref?.();
  }
  return { rules, settle };
}

/**
 * What the child is asked to share — a gentle description of the pattern,
 * never their words. The child sees it before the guardian does.
 */
function concernSummary(categories: SignalCategory[]): string {
  if (categories.includes("S4_treatment_refusal")) return "요즘 치료가 많이 힘들고 지쳐 보여요.";
  if (categories.includes("S8_loneliness")) return "요즘 외롭다고 느끼는 때가 자주 있어 보여요.";
  if (categories.includes("S3_hopeless_burden")) return "요즘 마음이 많이 지치고 무거워 보여요.";
  return DEFAULT_CONCERN_SUMMARY;
}

const EMPTY_REPLY = "응, 여기 있을게.";

function buildReply(
  text: string,
  provider: string,
  model: string,
  createdAt = new Date().toISOString()
): ConversationMessage {
  return {
    id: `msg-${Date.parse(createdAt)}`,
    role: "assistant",
    content: text.trim() || EMPTY_REPLY,
    createdAt,
    meta: { provider, model },
  };
}

/** History the model sees, and the child's recent lines the safety layer reads. */
function turnInputs(
  stored: ConversationMessage[],
  requestHistory: SendMessageRequest["history"]
) {
  const clientHistory = (requestHistory ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
  const historyForLlm =
    stored.length > 0
      ? forModelContext(stored).map(({ role, content }) => ({ role, content }))
      : clientHistory;
  // Declined turns stay in the safety context: they are often the ones that matter.
  const childContext = recentChildMessages(stored.length > 0 ? stored : clientHistory);
  return { historyForLlm, childContext };
}

export async function sendMessage(
  request: SendMessageRequest
): Promise<SendMessageResponse> {
  const userId = request.userId;
  const ctx = await resolveChildCompanionContext(userId, request.message);
  const { historyForLlm, childContext } = turnInputs(ctx.storedHistory, request.history);

  const userMessage: ConversationMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content: request.message,
    createdAt: new Date().toISOString(),
  };

  const priorAbuse = userId ? await hadRecentAbuseDisclosure(userId).catch(() => false) : false;
  const safety = startTurnSafety(userId, request.message, childContext, priorAbuse);
  let llm: Awaited<ReturnType<typeof companionChat>>;
  try {
    llm = await companionChat(
      request.message,
      historyForLlm,
      ctx.companion,
      turnAddendum(safety.rules, ctx.storedHistory)
    );
  } finally {
    // The safety outcome is written even when the reply fails.
    void safety.settle();
  }
  const final = await safety.settle();
  const reply = buildReply(guardReply(llm.content), llm.provider, llm.model);

  if (userId) {
    schedulePersistTurn({
      userId,
      userMessage,
      reply,
      profileSummary: ctx.profileSummary,
      refused: isRefusalReply(llm.content),
      protect: priorAbuse || toldOfHarm(final.assessment),
    });
  }

  if (!final.plan.showPanel) return { reply };
  const { type: _type, ...crisis } = crisisEvent(final.plan);
  return { reply, crisis };
}

/**
 * Stream assistant tokens. The guardian alert and signal log do not wait for
 * the stream; the turn is saved in `finally`, which also runs when the child
 * leaves mid-reply (the route's write fails and the generator is closed).
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

  const { historyForLlm, childContext } = turnInputs(ctx.storedHistory, request.history);
  const userMessage: ConversationMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content: request.message,
    createdAt: new Date().toISOString(),
  };

  // Safety writes start here, before anything streams (see startTurnSafety).
  // Harm told in the last days keeps the guardian out of a later alert too.
  const priorAbuse = userId ? await hadRecentAbuseDisclosure(userId).catch(() => false) : false;
  const safety = startTurnSafety(userId, request.message, childContext, priorAbuse);
  const { rules } = safety;

  const chatModel = resolveModelForPurpose("chat");
  // Each sentence is checked before it reaches the child's screen.
  const outputGuard = createOutputGuardStream();
  let full = "";
  let raw = "";
  /** The last help panel the client took (the route wrote it to the stream). */
  let delivered: SafetyResponsePlan | null = null;
  let reply: ConversationMessage | null = null;
  let failed = false;

  try {
    if (rules.plan.showPanel) {
      yield crisisEvent(rules.plan);
      delivered = rules.plan;
    }

    for await (const token of streamCompanionChat(
      request.message,
      historyForLlm,
      ctx.companion,
      turnAddendum(rules, ctx.storedHistory)
    )) {
      raw += token;
      const safe = outputGuard.push(token);
      if (safe) {
        full += safe;
        yield { type: "token", text: safe };
      }
    }
    const tail = outputGuard.flush();
    if (tail) {
      full += tail;
      yield { type: "token", text: tail };
    }

    // An ambiguous message may have been raised by the review (raise-only).
    const final = await safety.settle();
    if (final !== rules && final.plan.showPanel) {
      yield crisisEvent(final.plan);
      delivered = final.plan;
    }

    reply = buildReply(full, env.llmProvider, chatModel);
    yield { type: "done", reply };
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    recordOutputFlags(outputGuard.flags());
    const settled = safety.settle();
    if (userId && !failed) {
      const refused = raw.includes(REFUSAL_FALLBACK_TEXT) || isRefusalReply(full);
      const partial = full;
      const finished = reply;
      const shown = delivered;
      // Stamped now, when the reply stopped — not when the review settles.
      const endedAt = new Date().toISOString();
      void settled
        .then((final) => {
          let saved = finished ?? buildReply(partial, env.llmProvider, chatModel, endedAt);
          // The child left before the help panel reached them: the saved reply
          // says what was shared, so they read it when they come back.
          const note = final.plan.transparency;
          if (!finished && note && shown?.transparency !== note) {
            saved = { ...saved, content: `${saved.content}\n\n${note}` };
          }
          schedulePersistTurn({
            userId,
            userMessage,
            reply: saved,
            profileSummary: ctx.profileSummary,
            refused,
            protect: priorAbuse || toldOfHarm(final.assessment),
          });
        })
        .catch((error) => {
          console.error("[conversation] finishing the turn failed", error);
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
