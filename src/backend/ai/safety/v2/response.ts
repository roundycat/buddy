/**
 * What the app does for each safety level — child panel, LLM guidance for this
 * turn, and the minimal guardian alert. Pure (no I/O).
 *
 * Principles (UNICEF Guidance on AI and Children; WHO AI ethics; Beddy appendix):
 * - Never promise secrecy when safety is at risk; say plainly what was shared.
 * - Guardians get the fact that help is needed — never the child's words.
 * - When the child discloses harm by someone, do not route to the guardian
 *   automatically; point to people inside the hospital and public hotlines.
 */
import type { SafetyAssessment, SafetyLevel } from "./types";

export type SafetyActionId =
  | "notify_guardian"
  | "notify_nurse"
  | "counseling"
  | "emergency"
  | "social_worker"
  | "police"
  | "youth_counsel";

export interface SafetyAction {
  id: SafetyActionId;
  label: string;
  href?: string;
  hint: string;
}

export interface SafetyResponsePlan {
  level: SafetyLevel;
  /** Show the help panel in the chat sheet */
  showPanel: boolean;
  empathyHint: string;
  guidance: string;
  /** Plain statement of what was shared with whom (alert levels only) */
  transparency?: string;
  actions: SafetyAction[];
  /** Extra system instruction for this turn's LLM reply */
  systemAddendum?: string;
  /** Minimal guardian alert — facts only, no chat text */
  guardianAlert?: { level: "elevated" | "urgent"; summary: string };
}

const ACT: Record<SafetyActionId, SafetyAction> = {
  notify_guardian: {
    id: "notify_guardian",
    label: "보호자에게 직접 말하기",
    hint: "베디가 보호자에게 '도움이 필요하다'는 신호만 보냈어. 옆에 계시면 직접 말해도 좋아.",
  },
  notify_nurse: {
    id: "notify_nurse",
    label: "간호사 선생님께 알리기",
    hint: "병실·복도에 있는 간호사 선생님께 \"지금 마음이 많이 힘들어요. 도와주세요\"라고 말해 보자.",
  },
  counseling: {
    id: "counseling",
    label: "상담 전화 109",
    href: "tel:109",
    hint: "자살예방 상담전화 109는 24시간 이야기를 들어 줘.",
  },
  emergency: {
    id: "emergency",
    label: "지금 위험해요 · 119",
    href: "tel:119",
    hint: "지금 당장 위험하면 119에 도움을 요청해.",
  },
  social_worker: {
    id: "social_worker",
    label: "병원 사회복지 선생님",
    hint: "병원에는 어린이를 지켜 주는 사회복지 선생님이 있어. 간호사 선생님께 '사회복지 선생님을 만나고 싶어요'라고 말해 보자.",
  },
  police: {
    id: "police",
    label: "112 신고",
    href: "tel:112",
    hint: "누군가 너를 다치게 하거나 위협하면 112에 알릴 수 있어.",
  },
  youth_counsel: {
    id: "youth_counsel",
    label: "청소년 상담 1388",
    href: "tel:1388",
    hint: "1388은 어린이·청소년 고민을 들어 주는 상담 전화야.",
  },
};

const ALERT_ADDENDUM = `이번 메시지에서 자해·자살·죽음과 관련된 위기 신호가 감지되었습니다.
- 짧게 공감하고, 지금 곁에 있는 어른(보호자·간호사)에게 바로 이야기하자고 안내하세요.
- 앱의 도움 버튼(간호사·109·119)을 쓸 수 있다고 알려 주세요.
- 보호자에게는 '도움이 필요하다는 신호'만 전해졌고 대화 내용은 전해지지 않았다는 사실을 숨기지 마세요.
- 비밀을 지켜 주겠다고 약속하지 마세요. 상담사·의사처럼 길게 상담하지 마세요. 방법이나 수단에 대한 질문에는 답하지 마세요.`;

const WATCH_ADDENDUM = `아이의 말에 지침·무망감·외로움·치료에 대한 괴로움 같은 신호가 보입니다.
- 짧게 공감하고, 열린 질문 하나로 지금 마음을 물어보세요.
- 해결책을 늘어놓거나 훈계하지 마세요. "괜찮아질 거야"처럼 단정하지 마세요.
- 비슷한 말이 반복되면, 믿을 수 있는 어른(간호사·보호자·병원학교 선생님)과 이야기해 보자고 부드럽게 제안하세요.`;

const PROTECT_ADDENDUM = `아이가 누군가에게 맞거나, 위협받거나, 원치 않는 접촉을 당했다고 말했습니다.
- 아이의 말을 믿고, 네 잘못이 아니라고, 말해 줘서 고맙다고 하세요.
- 간호사 선생님, 병원 사회복지 선생님처럼 병원에 있는 믿을 수 있는 어른에게 알리자고 안내하세요.
- 아이가 가해자로 말한 사람에게 먼저 알리라고 권하지 마세요. 자세한 내용을 캐묻지 마세요.
- 비밀을 지켜 주겠다고 약속하지 마세요. 지금 위험하면 112에 알릴 수 있다고 알려 주세요.`;

const ALERT_PROTECT_ADDENDUM = `이번 메시지에서 위기 신호와 함께, 누군가에게 다치거나 위협받았다는 말이 있었습니다.
- 아이의 말을 믿고, 네 잘못이 아니라고, 말해 줘서 고맙다고 하세요.
- 지금 곁에 있는 간호사 선생님이나 병원 사회복지 선생님에게 바로 알리자고 안내하세요. 지금 위험하면 119, 누군가 위협하면 112에 알릴 수 있다고 알려 주세요.
- 이 이야기는 보호자에게 자동으로 전하지 않았습니다. 아이가 가해자로 말한 사람에게 먼저 알리라고 권하지 마세요.
- 비밀을 지켜 주겠다고 약속하지 마세요. 자세한 내용을 캐묻지 마세요. 방법이나 수단에 대한 질문에는 답하지 마세요.`;

const THIRD_PARTY_ADDENDUM = `아이가 친구나 다른 사람의 위험한 말을 전했습니다.
- 걱정하는 마음을 알아주고, 그 사람을 돕는 가장 좋은 방법은 선생님·간호사·보호자 같은 어른에게 알리는 것이라고 안내하세요.
- 아이 혼자 책임지지 않아도 된다고 말해 주세요.`;

const GUARDIAN_SUMMARY = {
  urgent:
    "아이에게 지금 안전이 걱정되는 신호가 있었어요. 바로 곁에 있어 주시고, 담당 의료진(간호사실)에도 알려 주세요. 위급하면 119, 상담은 자살예방 상담전화 109(24시간)를 이용할 수 있어요. 대화 원문은 공유되지 않습니다.",
  elevated:
    "아이의 마음이 많이 힘들다는 신호가 있었어요. 오늘은 곁에서 천천히 이야기를 들어 주시고, 필요하면 의료진이나 상담 기관(109)과 함께해 주세요. 대화 원문은 공유되지 않습니다.",
} as const;

/**
 * A death wish or self-harm signal together with harm by someone: keep the
 * urgency (119·109·nurse) but route like protect — the guardian may be the
 * person the child is talking about, so nothing is sent to the guardian.
 */
function protectRoutedAlert(level: "urgent" | "elevated"): SafetyResponsePlan {
  const urgent = level === "urgent";
  return {
    level,
    showPanel: true,
    empathyHint: urgent
      ? "말해 줘서 정말 고마워. 지금 네가 많이 위험하고 힘들다는 걸 느꼈어. 그건 절대 네 잘못이 아니야."
      : "말해 줘서 정말 고마워. 지금 마음이 많이 힘들다는 걸 느꼈어. 그건 절대 네 잘못이 아니야.",
    guidance: urgent
      ? "지금 바로 간호사 선생님께 말하자. 위험하면 119야."
      : "병원에 있는 믿을 수 있는 어른 — 간호사 선생님이나 사회복지 선생님 — 에게 지금 이야기해 보자.",
    transparency:
      "이 이야기는 보호자에게 자동으로 보내지 않았어. 누구에게 말할지는 너와 병원 선생님이 같이 정하면 돼.",
    actions: urgent
      ? [ACT.emergency, ACT.notify_nurse, ACT.social_worker, ACT.counseling, ACT.police, ACT.youth_counsel]
      : [ACT.notify_nurse, ACT.social_worker, ACT.counseling, ACT.police, ACT.youth_counsel, ACT.emergency],
    systemAddendum: ALERT_PROTECT_ADDENDUM,
  };
}

export function planSafetyResponse(a: SafetyAssessment): SafetyResponsePlan {
  if (a.abuse && (a.level === "urgent" || a.level === "elevated")) {
    return protectRoutedAlert(a.level);
  }
  switch (a.level) {
    case "urgent":
      return {
        level: "urgent",
        showPanel: true,
        empathyHint:
          "베디는 지금 네가 많이 위험하고 힘들다는 걸 느꼈어. 혼자 있지 말고 지금 바로 어른에게 알려 줘.",
        guidance: "지금 바로 간호사 선생님이나 곁에 있는 어른에게 말하자. 위험하면 119야.",
        transparency:
          "네 안전이 가장 중요해서, 보호자에게 '지금 도움이 필요하다'는 것만 알렸어. 우리가 나눈 대화 내용은 보여 주지 않아.",
        actions: [ACT.emergency, ACT.notify_nurse, ACT.counseling, ACT.notify_guardian],
        systemAddendum: ALERT_ADDENDUM,
        guardianAlert: { level: "urgent", summary: GUARDIAN_SUMMARY.urgent },
      };
    case "elevated":
      return {
        level: "elevated",
        showPanel: true,
        empathyHint:
          "베디는 지금 네 마음이 많이 힘들다는 걸 느꼈어. 이런 마음은 혼자 견디지 않아도 괜찮아.",
        guidance: "지금 엄마·아빠·보호자나 간호사 선생님께 마음이 힘들다고 이야기해 보자.",
        transparency:
          "이런 마음은 어른이 함께 알아야 해서, 보호자에게 '마음이 많이 힘들다'는 것만 알렸어. 우리가 나눈 대화 내용은 보여 주지 않아.",
        actions: [ACT.notify_nurse, ACT.counseling, ACT.notify_guardian, ACT.emergency],
        systemAddendum: ALERT_ADDENDUM,
        guardianAlert: { level: "elevated", summary: GUARDIAN_SUMMARY.elevated },
      };
    case "protect":
      return {
        level: "protect",
        showPanel: true,
        empathyHint:
          "말해 줘서 정말 고마워. 그건 절대 네 잘못이 아니야. 너는 안전하게 지내야 해.",
        guidance:
          "병원에 있는 믿을 수 있는 어른 — 간호사 선생님이나 사회복지 선생님 — 에게 이야기해 보자.",
        transparency:
          "이 이야기는 보호자에게 자동으로 보내지 않았어. 누구에게 말할지는 너와 병원 선생님이 같이 정하면 돼.",
        actions: [ACT.notify_nurse, ACT.social_worker, ACT.police, ACT.youth_counsel],
        systemAddendum: PROTECT_ADDENDUM,
      };
    case "watch":
      return {
        level: "watch",
        showPanel: false,
        empathyHint: "",
        guidance: "",
        actions: [],
        systemAddendum: WATCH_ADDENDUM,
      };
    default:
      return {
        level: "none",
        showPanel: false,
        empathyHint: "",
        guidance: "",
        actions: [],
        systemAddendum: a.thirdParty ? THIRD_PARTY_ADDENDUM : undefined,
      };
  }
}
