/**
 * Fast, local crisis signal detection for child chat.
 * Heuristic only — complements Bedrock Guardrails + safety prompts.
 * Never stores or returns the raw user message to parents.
 */

export type CrisisActionId =
  | "notify_guardian"
  | "notify_nurse"
  | "counseling"
  | "emergency";

export interface CrisisDetection {
  detected: boolean;
  level: "none" | "elevated" | "urgent";
  /** Parent-facing summary only — no raw chat */
  parentSummary: string;
  /** Child-facing empathy seed (model still responds; UI shows actions) */
  childEmpathyHint: string;
  actions: Array<{
    id: CrisisActionId;
    label: string;
    href?: string;
    hint: string;
  }>;
}

const URGENT_PATTERNS: RegExp[] = [
  /자살/,
  /죽고\s*싶/,
  /죽어\s*버리고/,
  /목숨을\s*끊/,
  /스스로\s*해치/,
  /자해/,
  /손목\s*그/,
  /목\s*매달/,
  /뛰어내리/,
  /유서/,
  /\bkill\s*myself\b/i,
  /\bsuicid/i,
  /\bself[-\s]?harm\b/i,
  /\bend\s*my\s*life\b/i,
];

const ELEVATED_PATTERNS: RegExp[] = [
  /사라지고\s*싶/,
  /없어지고\s*싶/,
  /살기\s*싫/,
  /살\s*가치/,
  /차라리\s*죽는/,
  /죽어버렸으면/,
  /세상에\s*없는\s*게/,
  /희망이\s*없/,
  /더\s*이상\s*못\s*견/,
  /혼자\s*있고\s*싶.*죽/,
  /\bi\s*want\s*to\s*die\b/i,
  /\bno\s*reason\s*to\s*live\b/i,
];

const CRISIS_ACTIONS: CrisisDetection["actions"] = [
  {
    id: "notify_guardian",
    label: "보호자에게 알리기",
    hint: "옆에 있는 엄마·아빠·보호자에게 지금 기분이 힘들다고 말해 보자.",
  },
  {
    id: "notify_nurse",
    label: "간호사 선생님께 알리기",
    hint: "병실·복도에 있는 간호사 선생님께 도와달라고 말해 보자.",
  },
  {
    id: "counseling",
    label: "상담센터 연결",
    href: "tel:109",
    hint: "자살예방 상담전화 109로 연결할 수 있어요. (24시간)",
  },
  {
    id: "emergency",
    label: "응급상황 신고",
    href: "tel:119",
    hint: "지금 당장 위험하면 119에 도움을 요청해요.",
  },
];

export function detectCrisisSignal(text: string): CrisisDetection {
  const raw = text.trim();
  if (!raw) {
    return {
      detected: false,
      level: "none",
      parentSummary: "",
      childEmpathyHint: "",
      actions: [],
    };
  }

  const urgent = URGENT_PATTERNS.some((re) => re.test(raw));
  const elevated = !urgent && ELEVATED_PATTERNS.some((re) => re.test(raw));

  if (!urgent && !elevated) {
    return {
      detected: false,
      level: "none",
      parentSummary: "",
      childEmpathyHint: "",
      actions: [],
    };
  }

  const level = urgent ? "urgent" : "elevated";
  return {
    detected: true,
    level,
    parentSummary:
      "오늘 아이에게 도움이 필요한 정서적 신호가 감지되었습니다. 아이와 함께 이야기를 나누어 주시고, 필요 시 담당 의료진 또는 전문 상담기관(자살예방 상담전화 109, 응급 119)의 도움을 받아 주세요. 대화 원문은 공유되지 않습니다.",
    childEmpathyHint:
      "베디는 지금 네 마음이 많이 힘들다는 걸 느꼈어. 이런 마음은 혼자 견디지 않아도 괜찮아.",
    actions: CRISIS_ACTIONS,
  };
}
