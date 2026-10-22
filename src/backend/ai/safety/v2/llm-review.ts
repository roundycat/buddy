import "server-only";
import { runLlm } from "@/backend/ai/llm-gateway";
import { env } from "@/backend/shared/config/env";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";
import { LlmRefusalError } from "@/backend/shared/llm/providers/anthropic.provider";
import { LEVEL_RANK, type SafetyAssessment, type SafetyLevel } from "./types";

/**
 * Optional second look by the chat model for messages the rule layer could not
 * read clearly (soft risk words, or a watch-level signal that might be more).
 *
 * Safety contract
 * - Runs in parallel with the reply. The chat uses the result if it arrives before
 *   the reply ends plus REVIEW_GRACE_MS, and never waits less than
 *   REVIEW_MIN_WINDOW_MS from the start; the admin evaluation uses that same
 *   minimum, so its numbers are a lower bound for the live path. A later result
 *   is dropped (logged), so nothing reaches a guardian that the child was not shown.
 * - Can only RAISE the level. It never lowers urgent/elevated or un-routes protect.
 * - Sends the child's words to the same model that already writes Beddy's reply;
 *   nothing new leaves the service. Returns a label only — no text is stored.
 */

const RUBRIC = `당신은 입원 아동용 AI 친구 앱의 안전 분류기입니다. 아이가 보낸 마지막 메시지를 보고 단계 하나만 고릅니다.
- urgent: 자살·자해 의도·계획·수단 탐색, 지금 자해 중이거나 방금 함
- elevated: 죽고 싶다·사라지고 싶다·안 깨어났으면 같은 죽음·소멸 소망, 자해 생각
- watch: 무망감, 짐 지각, 괴로움이 섞인 치료 거부, 깊은 외로움, 지금은 괜찮다는 과거 위험 경험
- protect: 누군가에게 맞거나 위협받거나 원치 않는 접촉을 당했다는 노출
- none: 일상, 과장 표현(배고파 죽겠다), 게임·드라마·스포츠·뉴스 속 죽음, 교육, 의료 질문, 흔한 짜증·무서움
판단이 갈리면 아이 안전 쪽으로 고릅니다. 이전 메시지는 문맥으로만 씁니다.
JSON 한 줄로만 답하세요: {"level":"none|watch|elevated|urgent|protect","reason":"20자 이내"}`;

const VALID = new Set<SafetyLevel>(["none", "watch", "elevated", "urgent", "protect"]);

/** Hard cap on one review call. */
export const REVIEW_TIMEOUT_MS = 6000;
/** How long the chat keeps waiting after the reply has finished streaming. */
export const REVIEW_GRACE_MS = 1500;
/** The chat never gives the review less than this, counted from the start. */
export const REVIEW_MIN_WINDOW_MS = 3000;

export function shouldReview(a: SafetyAssessment): boolean {
  if (env.llmProvider === "mock") return false;
  if ((process.env.SAFETY_LLM_REVIEW ?? "on").toLowerCase() === "off") return false;
  return a.ambiguous || a.level === "watch";
}

export async function reviewWithLlm(input: {
  text: string;
  context: string[];
  timeoutMs?: number;
}): Promise<SafetyLevel | null> {
  const payload = JSON.stringify({
    previous_messages: input.context.slice(-3),
    message: input.text,
  });
  const call = runLlm({
    feature: "safety.review",
    purpose: "analysis",
    temperature: 0,
    maxTokens: 80,
    // The child's own words are being classified; a topic guardrail would block the label.
    applyGuardrail: false,
    messages: [
      { role: "system", content: RUBRIC },
      { role: "user", content: payload },
    ],
  })
    .then((r) => {
      const parsed = extractJsonObject(r.content) as { level?: string } | null;
      const level = String(parsed?.level ?? "").trim() as SafetyLevel;
      return VALID.has(level) ? level : null;
    })
    // A declined classification means the words sit in a harmful area: keep a
    // watch record (no guardian alert). Any other failure leaves the rules' level.
    .catch((error) => (error instanceof LlmRefusalError ? ("watch" as const) : null));

  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), input.timeoutMs ?? REVIEW_TIMEOUT_MS)
  );
  return Promise.race([call, timeout]);
}

/**
 * Merge rule and review levels — raise only.
 * Routing never leaves protect: a protect reading (rules or review) sets `abuse`,
 * and the response plan keeps the guardian out of the loop whatever the urgency.
 */
export function mergeReviewedAssessment(
  rules: SafetyAssessment,
  reviewed: SafetyLevel | null
): SafetyAssessment {
  if (!reviewed || reviewed === rules.level) return rules;
  const abuse = rules.abuse || rules.level === "protect" || reviewed === "protect";
  let level: SafetyLevel;
  if (reviewed === "protect") {
    level = rules.level === "urgent" || rules.level === "elevated" ? rules.level : "protect";
  } else if (rules.level === "protect") {
    level = reviewed === "urgent" || reviewed === "elevated" ? reviewed : "protect";
  } else {
    level = LEVEL_RANK[reviewed] > LEVEL_RANK[rules.level] ? reviewed : rules.level;
  }
  if (level === rules.level && abuse === rules.abuse) return rules;
  return {
    ...rules,
    level,
    abuse,
    categories: abuse && !rules.categories.includes("S6_abuse")
      ? [...rules.categories, "S6_abuse"]
      : rules.categories,
    rules: [...rules.rules, "llm_review"],
  };
}
