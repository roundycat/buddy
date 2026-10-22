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

/** Medicine words. "약" only as a word of its own (not 약속, 예약, 절약). */
const DRUG =
  "(?:(?<![가-힣])약|진통제|수면제|해열제|항생제|스테로이드|항암제|알약|안정제|진정제|감기약|기침약|물약|타이레놀|부루펜|이부프로펜|아세트아미노펜)";
const COUNT = "(?:\\d+(?:\\.\\d+)?|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|스무|몇|여러|반)";
const UNIT = "(?:알|정|캡슐|포|방울|스푼|숟가락|mg|밀리그램|ml|㎖|cc)";
/** A medicine and an amount close together: "진통제 두 알", "약을 2정", "해열제를 반 알". */
const MED_DOSE = new RegExp(`${DRUG}[을를은는이가도]?\\s?(?:[가-힣]{1,4}\\s){0,2}${COUNT}\\s?${UNIT}`, "i");
/** Milligrams are always medicine. */
const MG_DOSE = /\d+(?:\.\d+)?\s?(?:mg|밀리그램)/i;
const INTAKE = /(먹어|먹으|먹으면|드세요|드시|복용|투여|넣어|발라|늘려|줄여|두\s?배|더\s?먹)/;
const MED_CHANGE =
  /(약|진통제|수면제|해열제|항생제|스테로이드|항암제)[을를은는이가]?\s?(끊어도\s?돼|끊어|그만\s?먹어도\s?돼|그만\s?먹어|안\s?먹어도\s?돼|줄여도\s?돼|늘려도\s?돼|두\s?배로|더\s?먹어도\s?돼)/;

/**
 * Self-harm method words, in two kinds.
 * Strong — only ever a method (hanging, cutting a wrist, charcoal, stockpiling
 * or overdosing medicine): replaced unless the sentence is a plain warning.
 * Weak — everyday words (jumping down, choking, pesticide): a method only next to
 * a high place, death words, how-to wording, or after method talk in the reply.
 */
const MED_GROUP = "(?:(?<![가-힣])약|수면제|진통제|알약|안정제|진정제|해열제|감기약)";
const STRONG_METHOD = [
  /(목을\s?(매다|매고|매면|매는|매서|맸|맬|매려|매자)|목\s?매달|목매달)/,
  /((손목|팔목|팔|피부|몸|살)[을를에]?\s?(?:[가-힣]{1,4}\s){0,2}(긋|그어|그으|그었|그을|베어|베면|베는|벴)|칼로\s?(긋|그어|그으|그었|그을))/,
  new RegExp(
    `${MED_GROUP}[을를은는이가]?\\s?(?:[가-힣]{1,4}\\s){0,2}(?:한꺼번에|한\\s?번에\\s?(?:많이|다|전부|몽땅)|많이\\s?모아|모아서|모아\\s?두|모아\\s?놓|왕창|잔뜩|통째로|한\\s?통|몽땅|(?:전부|다)\\s?삼키|(?:전부|다)\\s?삼켜)`
  ),
  /(과다\s?복용|과량\s?복용|약물\s?과다)/,
  /(번개탄|연탄을?\s?피우)/,
  /투신/,
];
const WEAK_METHOD = [
  /뛰어\s?내(리|려|릴|린|렸)/,
  /(질식|농약|목\s?졸|목을\s?졸)/,
  new RegExp(`${MED_GROUP}[을를]?\\s?(?:[가-힣]{1,4}\\s){0,2}많이\\s?(먹|삼키|삼켜)`),
];
const HIGH_PLACE = /(옥상|창문|창밖으로|아파트|베란다|난간|다리\s?위|한강|건물|높은\s?(곳|데)|\d+\s?층|꼭대기)/;
const DEATH_WORDS =
  /(죽고\s?싶|죽을래|죽을\s?거|죽으면|죽어\s?버|죽는\s?(게|법|방법)|죽게|자살|목숨을?\s?끊|생을\s?마감|세상을\s?떠나고|다\s?끝내|끝내고\s?싶|끝내\s?버|사라지고\s?싶|영원히\s?잠|안\s?깨어나)/;
/** Wording that teaches or recommends — wins over any warning word in the sentence. */
const ENDORSE = new RegExp(
  [
    "(?:으면|면)\\s?(?:돼|된다|됩니다|되거든|될\\s?거야|되잖아)",
    "확실(?:해|히|하게)",
    "편해(?:질|져)",
    "편하게\\s?(?:갈|죽|잠)",
    "안\\s?아파|아프지\\s?않",
    "금방\\s?끝|빨리\\s?끝|한\\s?번에\\s?끝",
    "안\\s?깨어나|깨어나지\\s?않|다시\\s?안\\s?깨|영원히\\s?잠|잠들\\s?수",
    "(?<!안\\s?)좋아(?!하)",
    "방법(?:은|이\\s?있|을\\s?알려)|하는\\s?법|이렇게\\s?하",
  ].join("|")
);
/** How-to wording that only counts with a strong method word. */
const STEPS = /(순서|단계|먼저\s|그다음|그\s?다음)/;
const METHOD_TALK = /(방법(?:은|이|을)|하는\s?법|이렇게\s?하)/;
/** A plain warning about the method. */
const PROHIBITION = new RegExp(
  [
    "(?:으면|면)\\s?(?:절대\\s?)?안\\s?(?:돼|된다|됩니다|되|되는)",
    "지\\s?(?:마|말아|말자|말아요|마세요)",
    "지\\s?않(?:아도|았으면|기를|게|도록)",
    "하지\\s?않",
    "그만\\s?둬|멈춰",
    "해로(?:우|워|운)",
    "위험하니까|위험하니|위험해서|위험하대|위험한\\s?(?:일|행동|거|짓)",
    "위험해(?:\\.|!|요|$)",
    "다칠\\s?수|크게\\s?다쳐|큰일\\s?(?:나|날)",
    "정해진\\s?만큼|주신\\s?대로|처방대로",
  ].join("|")
);

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
  return ((MED_DOSE.test(s) || MG_DOSE.test(s)) && INTAKE.test(s)) || MED_CHANGE.test(s);
}

/**
 * Method instruction or recommendation. `state.methodTalk` remembers that the
 * reply already talked about dying and a "way" ("죽고 싶다면 방법이 있어."), so a
 * weak method word in a later sentence counts too.
 */
function isMethodInstruction(s: string, state: OutputGuardState): boolean {
  const strong = STRONG_METHOD.some((re) => re.test(s));
  const weak = !strong && WEAK_METHOD.some((re) => re.test(s));
  if (!strong && !weak) {
    if (DEATH_WORDS.test(s) && METHOD_TALK.test(s)) state.methodTalk = true;
    return false;
  }
  if (strong) {
    if (ENDORSE.test(s) || STEPS.test(s)) return true;
    return !PROHIBITION.test(s);
  }
  const anchored = HIGH_PLACE.test(s) || DEATH_WORDS.test(s) || METHOD_TALK.test(s) || state.methodTalk;
  if (!anchored) return false;
  if (ENDORSE.test(s)) return true;
  return !PROHIBITION.test(s);
}

export interface OutputGuardState {
  used: Set<"medication" | "method" | "relationship">;
  flags: Set<OutputFlag>;
  /** An earlier sentence talked about dying and a way to do it. */
  methodTalk: boolean;
}

export function newOutputGuardState(): OutputGuardState {
  return { used: new Set(), flags: new Set(), methodTalk: false };
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
  if (isMethodInstruction(judged, state)) {
    state.flags.add("method");
    state.methodTalk = true;
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

/** The JSON in a model answer: whole, fenced, or between the first "{" and the last "}". */
function parseJsonAnswer(text: string): unknown | undefined {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const candidates = [raw];
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start > 0 && end > start) candidates.push(raw.slice(start, end + 1));
  for (const candidate of candidates) {
    if (!/^[[{]/.test(candidate)) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the next one */
    }
  }
  return undefined;
}

/**
 * Other child-facing model text (stories, missions, wish ideas, journal,
 * schedule copy): the same rules as the chat reply. A JSON answer has every
 * string value guarded and is re-serialised (JSON only, any prose around it
 * dropped) only when something changed; anything else is guarded as prose.
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
