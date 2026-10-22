/**
 * Text normalization for child-safety matching.
 *
 * Children dodge or mangle words: 자1살, 자.살, 죽 고 싶 다, 쥭고싶, ㅈㄱㅅㄷ.
 * We match on two views of the message:
 * - `text`    : NFKC + lowercase + filler symbols between Hangul removed, spaces kept.
 *               Used for short (2-syllable) words like 자살/자해 where removing spaces
 *               would invent matches ("자 살펴보자" → "자살펴보자").
 * - `compact` : `text` without spaces or punctuation. Used for longer phrases.
 */

const ZERO_WIDTH = /[​-‍⁠﻿]/g;

/**
 * Digits and symbols squeezed between two Hangul syllables to dodge filters.
 * Comma is excluded on purpose ("먹자,살 빠져" is ordinary writing).
 */
const FILLER_BETWEEN_HANGUL =
  /(?<=[가-힣ㄱ-ㅎ])[0-9.\-_*~·+!@#$%^&|\\/'"`]{1,3}(?=[가-힣ㄱ-ㅎ])/g;

const COMPACT_STRIP = /[\s.,!?~…·'"`()\[\]{}:;\-_^*+=<>|\\/]+/g;

export interface NormalizedText {
  /** NFKC, lowercase, zero-width removed — punctuation and spacing as typed */
  raw: string;
  /** Filler between syllables removed, whitespace collapsed */
  text: string;
  /** No whitespace, no punctuation */
  compact: string;
}

export function normalizeMessage(input: string): NormalizedText {
  // NFKC folds full-width letters and digits, but it would also turn Hangul
  // compatibility jamo (ㅈㅅ, ㅈㄱㅅㄷ) into conjoining jamo — keep those as typed.
  const raw = (input ?? "")
    .replace(/[^\u3131-\u318E]+/g, (run) => run.normalize("NFKC"))
    .replace(ZERO_WIDTH, "")
    .toLowerCase();
  const text = raw
    .replace(FILLER_BETWEEN_HANGUL, "")
    .replace(/\s+/g, " ")
    .trim();
  const compact = text.replace(COMPACT_STRIP, "");
  return { raw, text, compact };
}
