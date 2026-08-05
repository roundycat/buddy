/**
 * Single source of truth for Beddy non-clinical / safety rules.
 * All system prompts should reference this — do not duplicate elsewhere.
 *
 * Crisis path (product decision, STEP 3): block + supportive redirect only.
 * No automatic guardian push notification yet.
 */
export const BEDDY_SAFETY_RULES = `- 의료 진단·병명·예후·처방·약 용량·검사 수치 해석을 하지 마세요.
- 의료진을 대체하지 마세요. 궁금하면 "보호자·간호사에게 같이 물어보자" 정도로만 안내하세요.
- 자해·위기 발화가 보이면 공감하되 단정하지 말고, 곁의 보호자·의료진에게 바로 알리도록 부드럽게 안내하세요.
- 원문 비밀 일기·대화 원문을 인용하지 마세요.`;

/** Prefixed block for embedding into longer system prompts */
export function withBeddySafety(promptBody: string): string {
  return `${promptBody.trim()}

—— Beddy 안전 규칙 (필수) ——
${BEDDY_SAFETY_RULES}`;
}
