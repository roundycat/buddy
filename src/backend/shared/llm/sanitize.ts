/**
 * Models sometimes emit a template placeholder like `{NAME}` instead of
 * actually addressing the child. That must never reach a screen.
 *
 * Beyond swapping in the name, the Korean particle has to be rebuilt: the
 * affectionate "이" suffix only attaches to names that end in a 받침
 * (지민이가 / 수아가), and the model has no way to know which it needs.
 */

const KEYWORD =
  "(?:NAME|Name|name|CHILD_?NAME|Child_?Name|child_?name|childName|KID_?NAME|kid_?name|USER_?NAME|User_?Name|user_?name|userName|USER|User|user|이름|아이_? ?이름|아동_? ?이름|닉네임|호칭)";

/** `{NAME}` `{{name}}` `${name}` `[NAME]` `<child_name>` */
const PLACEHOLDER = `(?:\\$?\\{\\{?\\s*${KEYWORD}\\s*\\}\\}?|\\[\\s*${KEYWORD}\\s*\\]|<\\s*${KEYWORD}\\s*>)`;

/**
 * [written form, 받침 있는 이름, 받침 없는 이름]
 * Longest first so "이한테" wins over "이", and "이가" over "이".
 */
const PARTICLE_TABLE: ReadonlyArray<readonly [string, string, string]> = [
  ["이라는", "이라는", "라는"],
  ["라는", "이라는", "라는"],
  ["이라고", "이라고", "라고"],
  ["라고", "이라고", "라고"],
  ["이한테", "이한테", "한테"],
  ["한테", "이한테", "한테"],
  ["이에게", "이에게", "에게"],
  ["에게", "이에게", "에게"],
  ["이처럼", "이처럼", "처럼"],
  ["처럼", "이처럼", "처럼"],
  ["이보다", "이보다", "보다"],
  ["보다", "이보다", "보다"],
  ["이부터", "이부터", "부터"],
  ["부터", "이부터", "부터"],
  ["이까지", "이까지", "까지"],
  ["까지", "이까지", "까지"],
  ["이란", "이란", "란"],
  ["란", "이란", "란"],
  ["이랑", "이랑", "랑"],
  ["랑", "이랑", "랑"],
  ["이만", "이만", "만"],
  ["만", "이만", "만"],
  ["이도", "이도", "도"],
  ["도", "이도", "도"],
  ["이와", "이와", "와"],
  ["와", "이와", "와"],
  ["과", "이와", "와"],
  ["이의", "이의", "의"],
  ["의", "이의", "의"],
  ["이네", "이네", "네"],
  ["네", "이네", "네"],
  ["이야", "이야", "야"],
  ["이가", "이가", "가"],
  ["가", "이가", "가"],
  ["이는", "이는", "는"],
  ["는", "이는", "는"],
  ["은", "이는", "는"],
  ["이를", "이를", "를"],
  ["를", "이를", "를"],
  ["을", "이를", "를"],
  ["이", "이", ""],
  ["야", "아", "야"],
  ["아", "아", "야"],
];

const PARTICLE_FORMS = new Map(
  PARTICLE_TABLE.map(([written, withBatchim, withoutBatchim]) => [
    written,
    [withBatchim, withoutBatchim] as const,
  ])
);

/**
 * Single syllables that are just as likely to open a real word
 * ("이제", "만나서", "도와줄게"). Only treated as a particle at a boundary.
 */
const AMBIGUOUS = new Set(["이", "만", "도", "네", "와", "과", "의"]);

const PLACEHOLDER_WITH_PARTICLE = new RegExp(
  `${PLACEHOLDER}(${PARTICLE_TABLE.map(([written]) => written).join("|")})?`,
  "g"
);

const PLACEHOLDER_ONLY = new RegExp(PLACEHOLDER);

const HANGUL_SYLLABLE = /[가-힣]/;

/** Korean names take "이" before a particle only when the last block has a 받침. */
function hasFinalConsonant(name: string): boolean {
  const last = name.trim().slice(-1);
  if (!last) return false;

  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 !== 0;
  }

  // Latin names read the same way: "Kevin이가" but "Leo가".
  if (/[a-z]/i.test(last)) return !"aeiouy".includes(last.toLowerCase());

  return false;
}

/** "너" is a pronoun, not a name — "너가" is the one form we must not emit. */
function pronounForm(name: string, suffix: string): string | null {
  if (name !== "너") return null;
  return suffix === "가" ? "네가" : null;
}

export function hasNamePlaceholder(text: string): boolean {
  return typeof text === "string" && PLACEHOLDER_ONLY.test(text);
}

/**
 * Swap `{NAME}`-style placeholders for the child's actual name, rebuilding the
 * particle the model guessed at ("{NAME}가" + 지민 → 지민이가).
 *
 * With no name to use, the placeholder and its particle are dropped rather
 * than left behind as a dangling "이".
 */
export function fillNamePlaceholders(text: string, name?: string): string {
  if (!text || !hasNamePlaceholder(text)) return text;

  const clean = name?.trim();
  const batchim = clean ? hasFinalConsonant(clean) : false;
  let dropped = false;

  const replaced = text.replace(
    PLACEHOLDER_WITH_PARTICLE,
    (match, particle: string | undefined, offset: number, whole: string) => {
      const nextChar = whole.charAt(offset + match.length);
      const isParticle =
        Boolean(particle) &&
        !(AMBIGUOUS.has(particle!) && HANGUL_SYLLABLE.test(nextChar));
      // Not a particle after all — hand the syllable back as ordinary text.
      const tail = particle && !isParticle ? particle : "";

      if (!clean) {
        dropped = true;
        return tail;
      }

      const forms = isParticle ? PARTICLE_FORMS.get(particle!) : undefined;
      const suffix = forms ? forms[batchim ? 0 : 1] : "";
      return pronounForm(clean, suffix) ?? `${clean}${suffix}${tail}`;
    }
  );

  if (!dropped) return replaced;

  // Deleting a subject leaves orphan punctuation behind — tidy it up.
  return replaced
    .replace(/,\s*(?=[.!?…])/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t,·]+/gm, "")
    .trim();
}

const MAX_DEPTH = 8;

/**
 * Same swap across every string in an API payload — covers prose that was
 * already persisted with a placeholder in it.
 *
 * Returns the original reference when nothing changed.
 */
export function fillNamePlaceholdersDeep<T>(value: T, name?: string): T {
  return walk(value, name, 0) as T;
}

function walk(value: unknown, name: string | undefined, depth: number): unknown {
  if (depth > MAX_DEPTH) return value;

  if (typeof value === "string") {
    return fillNamePlaceholders(value, name);
  }

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((entry) => {
      const mapped = walk(entry, name, depth + 1);
      if (mapped !== entry) changed = true;
      return mapped;
    });
    return changed ? next : value;
  }

  if (value && typeof value === "object") {
    if (value instanceof Date) return value;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const mapped = walk(entry, name, depth + 1);
      if (mapped !== entry) changed = true;
      next[key] = mapped;
    }
    return changed ? next : value;
  }

  return value;
}

/** Longest placeholder + particle we could still be in the middle of. */
const STREAM_HOLD = 28;
const STREAM_MAX_HOLD = 96;

/**
 * Streaming variant: a placeholder can straddle two tokens, so release text
 * only once it can no longer be part of one. Lag is capped at
 * `STREAM_MAX_HOLD` characters so a brace-happy model can't stall the stream.
 */
export function createStreamingNameFilter(name?: string) {
  let buffer = "";

  function safeCut(): number {
    const windowStart = Math.max(0, buffer.length - STREAM_MAX_HOLD);
    let earliestOpener = -1;
    for (let i = buffer.length - 1; i >= windowStart; i--) {
      const char = buffer[i]!;
      if (char === "{" || char === "[" || char === "<" || char === "$") {
        earliestOpener = i;
      }
    }
    const byHold = Math.max(0, buffer.length - STREAM_HOLD);
    return earliestOpener === -1 ? byHold : Math.min(earliestOpener, byHold);
  }

  return {
    push(chunk: string): string {
      buffer += chunk;
      const cut = safeCut();
      if (cut <= 0) return "";
      const out = fillNamePlaceholders(buffer.slice(0, cut), name);
      buffer = buffer.slice(cut);
      return out;
    },
    flush(): string {
      const out = fillNamePlaceholders(buffer, name);
      buffer = "";
      return out;
    },
  };
}
