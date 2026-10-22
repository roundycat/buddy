/**
 * Output safety filter for Beddy's replies to the child (pure, no I/O).
 *
 * Runs on every provider as a second line of defence. With the Claude API there is
 * no Bedrock Guardrail in front of the model, so this layer carries the parts of
 * the guardrail the app depends on:
 * - personal data (e-mail, phone, resident-registration-like numbers) → masked
 * - medication instructions (dose + take/change, stopping medicine) → care-team line
 * - suicide / self-harm method instructions → safety line (nurse, guardian, 109, 119)
 * - relationship rules (exclusivity, secrecy from caregivers, romance, "I'm human")
 *
 * Works sentence by sentence so the streaming path can check each sentence before
 * it reaches the screen (createOutputGuardStream).
 */
import { findRelationshipViolations, type RelationshipViolation } from "./relationship";

export type OutputFlag = "pii" | "medication" | "method" | RelationshipViolation;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const MOBILE = /(?<!\d)(?:\+?82[-.\s]?)?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g;
const LANDLINE = /(?<!\d)0(?:2|[3-6][1-5])[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g;
const RRN = /(?<!\d)\d{6}[-\s]?[1-8]\d{6}(?!\d)/g;

const DOSE_UNIT = /\d+(?:\.\d+)?\s*(?:mg|밀리그램|ml|㎖|cc|알|정|캡슐|포|방울|스푼|숟가락)/i;
const INTAKE = /(먹어|먹으|먹으면|드세요|드시|복용|투여|넣어|발라|늘려|줄여|두\s?배|더\s?먹)/;
const MED_CHANGE =
  /(약|진통제|수면제|해열제|항생제|스테로이드|항암제)[을를은는이가]?\s?(끊어도\s?돼|끊어|그만\s?먹어도\s?돼|그만\s?먹어|안\s?먹어도\s?돼|줄여도\s?돼|늘려도\s?돼|두\s?배로|더\s?먹어도\s?돼)/;

const METHOD_WORDS =
  /(목을?\s?매|목\s?매달|뛰어\s?내리|투신|손목을?\s?(긋|그어|그으)|약을?\s?(한꺼번에|많이\s?모아|모아서)|과다\s?복용|질식|번개탄|농약|칼로\s?(긋|베))/;
const HOW_TO = /(방법|하는\s?법|하려면|하면\s?(돼|된다|됩니다)|순서|단계|이렇게\s?하|먼저\s|그다음|그\s?다음)/;

export const MEDICATION_LINE =
  "약이나 치료는 꼭 의사·간호사 선생님과 함께 정해야 해. 궁금한 건 선생님께 같이 여쭤보자.";
export const METHOD_LINE =
  "그건 알려 줄 수 없어. 너의 안전이 가장 중요해. 지금 곁에 있는 간호사 선생님이나 보호자에게 바로 말해 줘. 마음이 너무 힘들면 109(자살예방 상담), 위급하면 119야.";
export const RELATIONSHIP_LINE =
  "나는 너를 응원하는 AI 친구야. 엄마·아빠, 간호사 선생님, 친구들처럼 너를 아껴 주는 사람들과 나누는 시간도 꼭 소중히 했으면 좋겠어.";

const BOUNDARY = new Set([".", "!", "?", "。", "！", "？", "…", "~", "\n"]);

/** Index just after the last sentence end that is followed by whitespace (or a newline). */
function lastBoundary(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i]!;
    if (!BOUNDARY.has(ch)) continue;
    if (ch === "\n") return i + 1;
    const next = text[i + 1];
    if (next !== undefined && /\s/.test(next)) return i + 1;
  }
  return -1;
}

/** Sentences with their trailing punctuation and whitespace (joins back to the input). */
export function splitReplySentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (!BOUNDARY.has(ch)) continue;
    const next = text[i + 1];
    if (ch !== "\n" && next !== undefined && !/\s/.test(next) && !BOUNDARY.has(next)) continue;
    if (next !== undefined && BOUNDARY.has(next) && next !== "\n") continue; // "?!", "..."
    let end = i + 1;
    while (end < text.length && /[ \t]/.test(text[end]!)) end++;
    out.push(text.slice(start, end));
    start = end;
    i = end - 1;
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

function maskPii(sentence: string): { text: string; masked: boolean } {
  let masked = false;
  const sub = (re: RegExp, label: string) => (s: string) =>
    s.replace(re, () => {
      masked = true;
      return label;
    });
  const text = [
    sub(EMAIL, "[이메일]"),
    sub(RRN, "[개인번호]"),
    sub(MOBILE, "[전화번호]"),
    sub(LANDLINE, "[전화번호]"),
  ].reduce((s, f) => f(s), sentence);
  return { text, masked };
}

function isMedicationInstruction(s: string): boolean {
  return (DOSE_UNIT.test(s) && INTAKE.test(s)) || MED_CHANGE.test(s);
}

function isMethodInstruction(s: string): boolean {
  return METHOD_WORDS.test(s) && HOW_TO.test(s);
}

export interface OutputGuardState {
  used: Set<"medication" | "method" | "relationship">;
  flags: Set<OutputFlag>;
}

export function newOutputGuardState(): OutputGuardState {
  return { used: new Set(), flags: new Set() };
}

function trailingSpace(sentence: string): string {
  return sentence.match(/\s*$/)?.[0] ?? "";
}

/** Guard one chunk of whole sentences; replacement lines appear once per reply. */
export function guardSentences(chunk: string, state: OutputGuardState): string {
  let out = "";
  for (const sentence of splitReplySentences(chunk)) {
    if (!sentence.trim()) {
      out += sentence;
      continue;
    }
    if (isMethodInstruction(sentence)) {
      state.flags.add("method");
      if (!state.used.has("method")) {
        state.used.add("method");
        out += METHOD_LINE + trailingSpace(sentence);
      }
      continue;
    }
    if (isMedicationInstruction(sentence)) {
      state.flags.add("medication");
      if (!state.used.has("medication")) {
        state.used.add("medication");
        out += MEDICATION_LINE + trailingSpace(sentence);
      }
      continue;
    }
    const relationship = findRelationshipViolations(sentence);
    if (relationship.length) {
      relationship.forEach((v) => state.flags.add(v));
      if (!state.used.has("relationship")) {
        state.used.add("relationship");
        out += RELATIONSHIP_LINE + trailingSpace(sentence);
      }
      continue;
    }
    const pii = maskPii(sentence);
    if (pii.masked) state.flags.add("pii");
    out += pii.text;
  }
  return out;
}

/** Whole reply (non-streaming path). */
export function guardCompanionOutput(text: string): { text: string; flags: OutputFlag[] } {
  const state = newOutputGuardState();
  const guarded = guardSentences(text, state).trim();
  return { text: guarded, flags: Array.from(state.flags) };
}

/**
 * Streaming: push model tokens, get back only whole, checked sentences.
 * A run of 160+ characters without a sentence end is released at a space.
 */
export function createOutputGuardStream() {
  const state = newOutputGuardState();
  let buffer = "";
  return {
    push(token: string): string {
      buffer += token;
      let cut = lastBoundary(buffer);
      if (cut <= 0) {
        if (buffer.length < 160) return "";
        const space = buffer.lastIndexOf(" ");
        if (space < 40) return "";
        cut = space + 1;
      }
      const ready = buffer.slice(0, cut);
      buffer = buffer.slice(cut);
      return guardSentences(ready, state);
    },
    flush(): string {
      const rest = buffer;
      buffer = "";
      return rest ? guardSentences(rest, state) : "";
    },
    flags(): OutputFlag[] {
      return Array.from(state.flags);
    },
  };
}
