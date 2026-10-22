/**
 * Legal-guardian consent copy (개인정보 보호법 제22조의2 · 제23조).
 * MVP wording — replace with counsel-reviewed text before public launch.
 */

import type { GuardianRelationship } from "@/backend/features/consent/consent.types";

export const RELATIONSHIP_OPTIONS: Array<{
  id: GuardianRelationship;
  label: string;
}> = [
  { id: "father", label: "부" },
  { id: "mother", label: "모" },
  { id: "grandparent", label: "조부모" },
  { id: "other", label: "기타 법정대리인" },
];

export type GuardianConsentItemId =
  | "privacyCollection"
  | "sensitiveData"
  | "aiFeatures";

export const GUARDIAN_CONSENT_ITEMS: Array<{
  id: GuardianConsentItemId;
  title: string;
  summary: string;
  details: string[];
}> = [
  {
    id: "privacyCollection",
    title: "(필수) 아이의 개인정보 수집·이용",
    summary:
      "아이가 Beddy를 쓰는 데 필요한 정보만 모으고, 서비스 제공에만 써요.",
    details: [
      "수집 항목: 이름(닉네임), 이메일, 서비스 이용 기록, 아이가 남긴 대화·기록",
      "이용 목적: AI 친구 대화, 기록 보관, 보호자용 요약 제공",
      "보유 기간: 동의 철회 또는 회원 탈퇴 시까지",
    ],
  },
  {
    id: "sensitiveData",
    title: "(필수) 민감정보(마음·건강 관련 기록) 처리",
    summary:
      "감정 기록·마음 상태 분석·병원 일정처럼 마음과 건강에 관한 기록은 따로 동의를 받아요.",
    details: [
      "처리 항목: 감정 정원 기록, 대화 속 마음 상태 분석 결과, 병원 일정",
      "처리 목적: 마음 돌봄 미션·요약, 위기 신호가 있을 때의 최소 안전 알림",
      "개인정보 보호법 제23조에 따라 다른 항목과 분리해 동의받아요.",
    ],
  },
  {
    id: "aiFeatures",
    title: "(필수) AI 생성 기능 이용",
    summary:
      "AI 친구와의 대화, 그림·이야기 만들기, 보호자용 요약에 생성형 AI를 사용해요.",
    details: [
      "사용 모델: Anthropic Claude(대화·요약). 운영 환경에 따라 Claude API(Anthropic, 미국) 또는 Amazon Bedrock(미국 리전)으로 처리하고, 보낸 내용은 모델 학습에 쓰이지 않아요.",
      "그림: 미리 준비한 그림을 쓰거나, AWS 환경에서는 Amazon Bedrock의 이미지 모델로 그려요.",
      "AI가 만든 내용은 진단·처방이 아니며, 참고용이에요.",
      "보호자용 요약은 아이가 나누기로 한 항목으로만 만들어요.",
    ],
  },
];

export const GUARDIAN_CONSENT_PRIVACY_NOTE =
  "아이와 베디의 대화 원문은 보호자에게 절대 보여 주지 않아요. 보호자 화면에는 아이가 나누기로 한 요약만 보여요.";

export const GUARDIAN_CONSENT_WITHDRAW_NOTE =
  "동의는 설정에서 언제든 철회할 수 있어요. 철회하면 지금까지 모인 아이의 대화·기록을 바로 지우고, AI 기능을 다시 잠가요.";
