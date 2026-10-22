/**
 * Korean particles that depend on the last syllable (받침).
 * Pure, safe in client and server code.
 */
function endsWithBatchim(word: string): boolean {
  const last = word.trim().slice(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  // Digits and Latin letters read with a final consonant in Korean
  return /[013678LMNR]$/i.test(last);
}

/** The final consonant is ㄹ — "(으)로" takes 로 then: "연필로", "교실로", "1로". */
function endsWithRieul(word: string): boolean {
  const last = word.trim().slice(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 8;
  return /[178L]$/i.test(last);
}

/** 은/는 — topic marker: "여름은", "하늘은", "지민은", "새봄은", "바다는" */
export function topic(word: string): string {
  return `${word}${topicParticle(word)}`;
}

/** Just the 은/는 for a word — for a quoted word: “검사”는 */
export function topicParticle(word: string): "은" | "는" {
  return endsWithBatchim(word) ? "은" : "는";
}

/** 이/가 — subject marker */
export function subject(word: string): string {
  return `${word}${endsWithBatchim(word) ? "이" : "가"}`;
}

/** 을/를 — object marker */
export function object(word: string): string {
  return `${word}${objectParticle(word)}`;
}

/** Just the 을/를 for a word — for when the word is quoted: ‘산책’을 */
export function objectParticle(word: string): "을" | "를" {
  return endsWithBatchim(word) ? "을" : "를";
}

/** Just the 이/가 for a word — for a quoted word: “불안”이 */
export function subjectParticle(word: string): "이" | "가" {
  return endsWithBatchim(word) ? "이" : "가";
}

/** 와/과 — "지민과", "수아와" */
export function withAnd(word: string): string {
  return `${word}${endsWithBatchim(word) ? "과" : "와"}`;
}

/** (으)로 — "용기로", "기쁨으로", "교실로" */
export function withRo(word: string): string {
  return `${word}${endsWithBatchim(word) && !endsWithRieul(word) ? "으로" : "로"}`;
}

/** 이에요/예요 — "불안이에요", "외로움이에요", "하루예요" */
export function politeIs(word: string): string {
  return `${word}${copulaParticle(word)}`;
}

/** Just the 이에요/예요 for a word — for a quoted word: “불안”이에요 */
export function copulaParticle(word: string): "이에요" | "예요" {
  return endsWithBatchim(word) ? "이에요" : "예요";
}

/** A name as friends call it — 이 only after a final consonant: "지민이", "수아" */
export function callName(word: string): string {
  return endsWithBatchim(word) ? `${word}이` : word;
}

