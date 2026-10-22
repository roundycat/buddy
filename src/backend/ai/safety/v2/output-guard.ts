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
/** "두 알", "반 알" — counted in words; only with a medicine noun (포도 한 알 is food). */
const DOSE_WORDS = /(한|두|세|네|다섯|여섯|반)\s?(알|정|캡슐|포|방울)/;
const MED_NOUN =
  /((^|[^가-힣])약(?=[을를은는이가도만\s,.!?]|$)|진통제|수면제|해열제|항생제|스테로이드|항암제|알약|안정제|진정제|캡슐|시럽)/;
const INTAKE = /(먹어|먹으|먹으면|드세요|드시|복용|투여|넣어|발라|늘려|줄여|두\s?배|더\s?먹)/;
const MED_CHANGE =
  /(약|진통제|수면제|해열제|항생제|스테로이드|항암제)[을를은는이가]?\s?(끊어도\s?돼|끊어|그만\s?먹어도\s?돼|그만\s?먹어|안\s?먹어도\s?돼|줄여도\s?돼|늘려도\s?돼|두\s?배로|더\s?먹어도\s?돼)/;

/** Any self-harm method word — a method instruction together with how-to wording. */
const METHOD_WORDS =
  /(목을?\s?매|목\s?매달|뛰어\s?내리|투신|손목을?\s?(긋|그어|그으|그었)|(약|수면제|진통제|알약|안정제)[을를]?\s?(한꺼번에|많이\s?모아|모아서|모아\s?두|왕창|통째로)|과다\s?복용|질식|번개탄|농약|칼로\s?(긋|그어|그으|베))/;
/**
 * Words that name a self-harm method on their own. In a reply to a child they
 * are replaced unless the sentence is a plain warning ("절대 안 돼").
 */
const METHOD_STRONG =
  /(목을\s?매|목\s?매달|투신|손목을?\s?(긋|그어|그으|그었)|(약|수면제|진통제|알약|안정제|해열제)[을를]?\s?(한꺼번에|한\s?번에\s?(많이|다)|많이\s?모아|모아서|모아\s?두|왕창|통째로)|과다\s?복용|번개탄|칼로\s?(긋|그어|그으|베))/;
/** Everyday words that name a method only next to death words. */
const METHOD_WEAK = /(뛰어\s?내리|질식|농약|목\s?졸)/;
const DEATH_WORDS = /(죽|자살|목숨|생을|끝내|끝낼|끝나|끝날|편해질|편해져)/;
const PROHIBITION =
  /(절대|지\s?(마|말아|말자|말고)|하면\s?안|면\s?안\s?(돼|된다|됩니다)|안\s?돼|위험(해|한|하)|않아도|않았으면|하지\s?않|멈춰|그만둬|그만\s?둬)/;
const HOW_TO = /(방법|하는\s?법|하려면|하면\s?(돼|된다|됩니다)|순서|단계|이렇게\s?하|먼저\s|그다음|그\s?다음)/;

export const MEDICATION_LINE =
  "약이나 치료는 꼭 의사·간호사 선생님과 함께 정해야 해. 궁금한 건 선생님께 같이 여쭤보자.";
export const METHOD_LINE =
  "그건 알려 줄 수 없어. 너의 안전이 가장 중요해. 지금 곁에 있는 간호사 선생님이나 보호자에게 바로 말해 줘. 마음이 너무 힘들면 109(자살예방 상담), 위급하면 119야.";
export const RELATIONSHIP_LINE =
  "나는 너를 응원하는 AI 친구야. 엄마·아빠, 간호사 선생님, 친구들처럼 너를 아껴 주는 사람들과 나누는 시간도 꼭 소중히 했으면 좋겠어.";
export const SECRECY_LINE =
  "네 이야기는 소중하게 들을게. 그런데 네가 다치거나 위험할 수 있는 일이면, 너를 지키려고 어른에게 알려야 할 때도 있어.";

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
  return (
    (DOSE_UNIT.test(s) && INTAKE.test(s)) ||
    (DOSE_WORDS.test(s) && MED_NOUN.test(s) && INTAKE.test(s)) ||
    MED_CHANGE.test(s)
  );
}

function isMethodInstruction(s: string): boolean {
  if (METHOD_WORDS.test(s) && HOW_TO.test(s)) return true;
  if (PROHIBITION.test(s)) return false;
  return METHOD_STRONG.test(s) || (METHOD_WEAK.test(s) && DEATH_WORDS.test(s));
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

/**
 * Guard one chunk of whole sentences; replacement lines appear once per reply.
 * `carry` is the start of a sentence already released before its end (a long
 * run without punctuation): the chunk's first sentence is judged together with
 * it, so a rule cannot be dodged by splitting a sentence in two.
 */
export function guardSentences(chunk: string, state: OutputGuardState, carry = ""): string {
  let out = "";
  splitReplySentences(chunk).forEach((sentence, index) => {
    if (!sentence.trim()) {
      out += sentence;
      return;
    }
    const judged = index === 0 && carry ? `${carry}${sentence}` : sentence;
    out += guardOne(sentence, judged, state);
  });
  return out;
}

/** One sentence: a replacement line (once per reply and kind), or the sentence with PII masked. */
function guardOne(sentence: string, judged: string, state: OutputGuardState): string {
  const once = (kind: "medication" | "method" | "relationship", line: string) => {
    if (state.used.has(kind)) return "";
    state.used.add(kind);
    return line + trailingSpace(sentence);
  };
  if (isMethodInstruction(judged)) {
    state.flags.add("method");
    return once("method", METHOD_LINE);
  }
  if (isMedicationInstruction(judged)) {
    state.flags.add("medication");
    return once("medication", MEDICATION_LINE);
  }
  const relationship = findRelationshipViolations(judged);
  if (relationship.length) {
    relationship.forEach((v) => state.flags.add(v));
    // Secrecy gets an honest line about when grown-ups must be told.
    const secrecyOnly = relationship.includes("secrecy") && !relationship.includes("exclusivity");
    return once("relationship", secrecyOnly ? SECRECY_LINE : RELATIONSHIP_LINE);
  }
  const pii = maskPii(sentence);
  if (pii.masked) state.flags.add("pii");
  return pii.text;
}

/** Whole reply (non-streaming path). */
export function guardCompanionOutput(text: string): { text: string; flags: OutputFlag[] } {
  const state = newOutputGuardState();
  const guarded = guardSentences(text, state).trim();
  return { text: guarded, flags: Array.from(state.flags) };
}

/** A run this long without a sentence end is released at a space. */
const FORCED_CUT = 400;

/**
 * Streaming: push model tokens, get back only whole, checked sentences.
 * A run of FORCED_CUT+ characters without a sentence end is released at a
 * space; the released part is kept as context for judging the rest of that
 * sentence (see guardSentences).
 */
export function createOutputGuardStream() {
  const state = newOutputGuardState();
  let buffer = "";
  let carry = "";
  return {
    push(token: string): string {
      buffer += token;
      let cut = lastBoundary(buffer);
      let forced = false;
      if (cut <= 0) {
        if (buffer.length < FORCED_CUT) return "";
        const space = buffer.lastIndexOf(" ");
        if (space < 40) return "";
        cut = space + 1;
        forced = true;
      }
      const ready = buffer.slice(0, cut);
      buffer = buffer.slice(cut);
      const out = guardSentences(ready, state, carry);
      if (forced) {
        // Only the unfinished last sentence carries over.
        const parts = splitReplySentences(ready);
        carry = `${parts.length > 1 ? "" : carry}${parts[parts.length - 1] ?? ""}`.slice(-FORCED_CUT);
      } else {
        carry = "";
      }
      return out;
    },
    flush(): string {
      const rest = buffer;
      buffer = "";
      const out = rest ? guardSentences(rest, state, carry) : "";
      carry = "";
      return out;
    },
    flags(): OutputFlag[] {
      return Array.from(state.flags);
    },
  };
}

function parseJsonAnswer(text: string): unknown | undefined {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  if (!/^[[{]/.test(raw)) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Other child-facing model text (stories, missions, wish ideas, journal,
 * schedule copy): the same rules as the chat reply. A JSON answer has every
 * string value guarded and is re-serialised only when something changed;
 * anything else is guarded as prose.
 */
export function guardChildFacingOutput(content: string): { text: string; flags: OutputFlag[] } {
  const json = parseJsonAnswer(content);
  if (json === undefined) return guardCompanionOutput(content);
  const flags = new Set<OutputFlag>();
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") {
      const r = guardCompanionOutput(value);
      r.flags.forEach((f) => flags.add(f));
      return r.flags.length ? r.text : value;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
    }
    return value;
  };
  const guarded = walk(json);
  return flags.size
    ? { text: JSON.stringify(guarded), flags: Array.from(flags) }
    : { text: content, flags: [] };
}
