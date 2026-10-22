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

/** 은/는 — topic marker: "여름은", "하늘은", "지민은", "새봄은", "바다는" */
export function topic(word: string): string {
  return `${word}${endsWithBatchim(word) ? "은" : "는"}`;
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
