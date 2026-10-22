/**
 * Guardian-text leak guard — catches the child's own words crossing into
 * guardian-facing text (summaries, empathy guides, Q&A answers, KB docs).
 *
 * Pure: no server-only import, no I/O. Heuristic by design — it is a last
 * line of defence after prompts and the Bridge privacy filter, so it leans
 * toward flagging; callers swap in a template fallback when it fires.
 *
 *  - verbatim         4+ consecutive eojeol, or 12+ consecutive Hangul, shared with a child message
 *  - quote            quoted / reported speech (…라고 했어요) that carries child wording
 *  - secret           content from a message the child marked secret (비밀, 말하지 마, 몰래 …)
 *  - third_party_name a person's name used by the child (민지, 김OO 간호사); roles are fine
 *  - location         room / floor / ward numbers, addresses, coordinates
 */

export type LeakType =
  | "verbatim"
  | "quote"
  | "secret"
  | "third_party_name"
  | "location";

export interface LeakCheck {
  leak: boolean;
  types: LeakType[];
  spans: string[];
}

const TYPE_ORDER: LeakType[] = [
  "verbatim",
  "quote",
  "secret",
  "third_party_name",
  "location",
];

const VERBATIM_MIN_EOJEOL = 4;
const VERBATIM_MIN_HANGUL = 12;
/** A shared eojeol window must carry this much Hangul to count. */
const WINDOW_MIN_HANGUL = 8;
const QUOTE_MIN_COMMON = 4;
const QUOTE_STRONG_COMMON = 6;
const QUOTE_COVERAGE = 0.8;
const SECRET_MIN_COMMON = 6;
const MAX_SPANS = 12;

/* ------------------------------------------------------------------ */
/* Hangul helpers                                                      */
/* ------------------------------------------------------------------ */

function isHangulSyllable(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3;
}

function hasBatchim(ch: string): boolean {
  return isHangulSyllable(ch) && (ch.charCodeAt(0) - 0xac00) % 28 !== 0;
}

function normalize(text: string): string {
  return (text ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

interface HangulProjection {
  chars: string;
  /** Index in the source text for each Hangul char */
  index: number[];
}

function projectHangul(text: string): HangulProjection {
  let chars = "";
  const index: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (isHangulSyllable(ch)) {
      chars += ch;
      index.push(i);
    }
  }
  return { chars, index };
}

function hangulOnly(text: string): string {
  return projectHangul(text).chars;
}

function longestCommonSubstring(
  a: string,
  b: string
): { length: number; aStart: number } {
  if (!a || !b) return { length: 0, aStart: 0 };
  let best = 0;
  let bestEnd = 0;
  let prev = new Uint16Array(b.length + 1);
  let cur = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      if (ac === b.charCodeAt(j - 1)) {
        const v = prev[j - 1]! + 1;
        cur[j] = v;
        if (v > best) {
          best = v;
          bestEnd = i;
        }
      } else {
        cur[j] = 0;
      }
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return { length: best, aStart: bestEnd - best };
}

/* ------------------------------------------------------------------ */
/* Eojeol tokens + 조사 normalisation                                   */
/* ------------------------------------------------------------------ */

const PARTICLES = [
  "에서부터",
  "으로부터",
  "에게서",
  "한테서",
  "으로는",
  "에서는",
  "에게는",
  "한테는",
  "이라도",
  "이라고",
  "이랑은",
  "께서는",
  "이랑",
  "에서",
  "에게",
  "한테",
  "께서",
  "부터",
  "까지",
  "처럼",
  "보다",
  "마저",
  "조차",
  "으로",
  "이나",
  "하고",
  "이요",
  "라고",
  "랑",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "에",
  "의",
  "도",
  "만",
  "와",
  "과",
  "로",
  "요",
  "께",
].sort((a, b) => b.length - a.length);

function stripParticle(token: string): string {
  for (const p of PARTICLES) {
    if (token.length > p.length && token.endsWith(p)) {
      return token.slice(0, -p.length);
    }
  }
  return token;
}

interface Eojeol {
  raw: string;
  norm: string;
}

/** Anything that is not a letter/digit we care about splits eojeol. */
const TOKEN_SPLIT_RE =
  /[^0-9A-Za-zÀ-ɏᄀ-ᇿ㄰-㆏가-힣]+/;

function eojeols(text: string): Eojeol[] {
  return text
    .split(TOKEN_SPLIT_RE)
    .filter((t) => t && /[가-힣A-Za-z0-9]/.test(t))
    .map((raw) => ({ raw, norm: stripParticle(raw.toLowerCase()) }));
}

/** Everyday words that make a shared window "generic" rather than a copy. */
const GENERIC_WORDS = new Set([
  "오늘",
  "어제",
  "내일",
  "지금",
  "아까",
  "이따",
  "요즘",
  "이제",
  "아직",
  "벌써",
  "항상",
  "가끔",
  "자주",
  "정말",
  "진짜",
  "너무",
  "아주",
  "매우",
  "조금",
  "많이",
  "그냥",
  "엄청",
  "되게",
  "완전",
  "계속",
  "다시",
  "같이",
  "함께",
  "혼자",
  "서로",
  "모두",
  "우리",
  "그리고",
  "그래서",
  "근데",
  "그런데",
  "하지만",
  "그러면",
  "그럼",
  "그런",
  "이런",
  "어떤",
  "무슨",
  "하루",
  "마음",
  "기분",
  "생각",
  "시간",
  "이야기",
  "얘기",
  "있어",
  "없어",
  "했어",
  "해서",
  "하고",
  "좋아",
  "싫어",
  "같아",
  "싶어",
  "괜찮아",
  "그래",
  "맞아",
  "사실",
  "그거",
  "이거",
  "저거",
  "그게",
  "이게",
  "뭔가",
  "제발",
  "절대",
  "약속",
  "약속해",
  "알았지",
]);

function hangulLength(text: string): number {
  return hangulOnly(text).length;
}

function isSubstantialWindow(norms: string[]): boolean {
  const total = norms.reduce((n, t) => n + hangulLength(t), 0);
  if (total < WINDOW_MIN_HANGUL) return false;
  const specific = norms.filter(
    (t) => hangulLength(t) >= 2 && !GENERIC_WORDS.has(t)
  ).length;
  return specific >= 2;
}

/* ------------------------------------------------------------------ */
/* verbatim                                                            */
/* ------------------------------------------------------------------ */

function findVerbatim(
  guardian: string,
  childTexts: string[]
): string[] {
  const spans: string[] = [];

  // (a) 4+ consecutive normalised eojeol
  const windows = new Set<string>();
  for (const msg of childTexts) {
    const norms = eojeols(msg).map((e) => e.norm);
    for (let i = 0; i + VERBATIM_MIN_EOJEOL <= norms.length; i++) {
      windows.add(norms.slice(i, i + VERBATIM_MIN_EOJEOL).join("\u0001"));
    }
  }
  const gTokens = eojeols(guardian);
  let i = 0;
  while (i + VERBATIM_MIN_EOJEOL <= gTokens.length) {
    const slice = gTokens.slice(i, i + VERBATIM_MIN_EOJEOL);
    const norms = slice.map((e) => e.norm);
    if (windows.has(norms.join("\u0001")) && isSubstantialWindow(norms)) {
      let end = i + VERBATIM_MIN_EOJEOL;
      // Extend while the next window still matches
      while (
        end < gTokens.length &&
        windows.has(
          gTokens
            .slice(end - VERBATIM_MIN_EOJEOL + 1, end + 1)
            .map((e) => e.norm)
            .join("\u0001")
        )
      ) {
        end += 1;
      }
      spans.push(
        gTokens
          .slice(i, end)
          .map((e) => e.raw)
          .join(" ")
      );
      i = end;
      continue;
    }
    i += 1;
  }

  // (b) 12+ consecutive Hangul characters (spacing / punctuation ignored)
  const grams = new Set<string>();
  for (const msg of childTexts) {
    const h = hangulOnly(msg);
    for (let k = 0; k + VERBATIM_MIN_HANGUL <= h.length; k++) {
      grams.add(h.slice(k, k + VERBATIM_MIN_HANGUL));
    }
  }
  if (grams.size > 0) {
    const proj = projectHangul(guardian);
    let k = 0;
    while (k + VERBATIM_MIN_HANGUL <= proj.chars.length) {
      if (grams.has(proj.chars.slice(k, k + VERBATIM_MIN_HANGUL))) {
        let end = k + VERBATIM_MIN_HANGUL;
        while (
          end < proj.chars.length &&
          grams.has(proj.chars.slice(end - VERBATIM_MIN_HANGUL + 1, end + 1))
        ) {
          end += 1;
        }
        spans.push(
          guardian.slice(proj.index[k]!, proj.index[end - 1]! + 1)
        );
        k = end;
        continue;
      }
      k += 1;
    }
  }

  return spans;
}

/* ------------------------------------------------------------------ */
/* quote                                                               */
/* ------------------------------------------------------------------ */

const QUOTE_PAIRS: Array<[string, string]> = [
  ["“", "”"],
  ['"', '"'],
  ["‘", "’"],
  ["'", "'"],
  ["「", "」"],
  ["『", "』"],
  ["«", "»"],
  ["《", "》"],
  ["〈", "〉"],
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const QUOTE_RES = QUOTE_PAIRS.map(([open, close]) => {
  const o = escapeRe(open);
  const c = escapeRe(close);
  return new RegExp(`${o}([^${o}${c}\\n]{1,160})${c}`, "g");
});

/** …라고 했어요 / …다고 말했어요 */
const REPORTED_RE =
  /([^.!?。\n“”"‘’'「」『』]{2,80}?)\s?(?:이라고|라고|다고|냐고|자고|이라며|라며|다며)\s?(?:했|말했|말하|얘기했|얘기하|이야기했|이야기하|하더|하였|전했|적었|썼|털어놓|고백)/g;

/** …했대요 / …래요 (hearsay) */
const HEARSAY_RE =
  /([^.!?。\n“”"‘’'「」『』]{4,80}?)(?:더래요|대요|래요|다더라고요|더라고요)(?=$|[\s.!?,~])/g;

function quoteCarriesChildWording(span: string, childHangul: string[]): boolean {
  const s = hangulOnly(span);
  if (s.length < QUOTE_MIN_COMMON) return false;
  for (const c of childHangul) {
    if (c.length < QUOTE_MIN_COMMON) continue;
    const { length } = longestCommonSubstring(s, c);
    if (length >= QUOTE_STRONG_COMMON) return true;
    if (
      length >= QUOTE_MIN_COMMON &&
      length / Math.min(s.length, c.length) >= QUOTE_COVERAGE
    ) {
      return true;
    }
  }
  return false;
}

function findQuotes(guardian: string, childTexts: string[]): string[] {
  const childHangul = childTexts.map(hangulOnly);
  const candidates: string[] = [];
  for (const re of QUOTE_RES) {
    re.lastIndex = 0;
    for (const m of Array.from(guardian.matchAll(re))) candidates.push(m[1]!.trim());
  }
  for (const re of [REPORTED_RE, HEARSAY_RE]) {
    re.lastIndex = 0;
    for (const m of Array.from(guardian.matchAll(re))) candidates.push(m[1]!.trim());
  }
  return candidates.filter((span) =>
    quoteCarriesChildWording(span, childHangul)
  );
}

/* ------------------------------------------------------------------ */
/* secret                                                              */
/* ------------------------------------------------------------------ */

const SECRET_MARKER_RE =
  /비밀(?!번호)|말하지\s?마|말\s?하지\s?마|말하면\s?안\s?돼|얘기하지\s?마|이야기하지\s?마|알리지\s?마|이르지\s?마|일러바치지|모르게|몰래|아무(?:한테|에게)도|우리\s?끼리|너만\s?알|쉿|숨기|숨겨|들키/;

const SECRET_MARKER_GLOBAL_RE = new RegExp(SECRET_MARKER_RE.source, "g");

/** "Don't tell mom" — the addressee is not part of the secret itself. */
const SECRET_ADDRESSEE_RE =
  /(?:엄마|아빠|부모님|선생님|간호사|언니|오빠|누나|형|할머니|할아버지|아무)(?:한테|에게|께)?(?:는|도)?/g;

/** Two-syllable openings too common to tie an inflected verb to a secret. */
const PREFIX_STOPWORDS = new Set([
  "보고",
  "하고",
  "있어",
  "있는",
  "없어",
  "없는",
  "했어",
  "해서",
  "하는",
  "해요",
  "같이",
  "같아",
  "싶어",
  "싶은",
  "그래",
  "그런",
  "이런",
  "아니",
  "좋아",
  "좋은",
  "싫어",
  "많이",
  "너무",
  "정말",
  "진짜",
  "그냥",
  "오늘",
  "내일",
  "어제",
  "마음",
  "기분",
  "생각",
]);

function secretContentWords(msg: string): string[] {
  return Array.from(
    new Set(
      eojeols(msg)
        .map((e) => e.norm)
        .filter(
          (t) =>
            hangulLength(t) >= 2 &&
            !SECRET_MARKER_RE.test(t) &&
            !GENERIC_WORDS.has(t) &&
            !NAME_STOPWORDS.has(t) &&
            !/^(?:말하지|말하면|얘기하지|이야기하지|알리지|이르지|아무한테|아무에게)$/.test(t)
        )
    )
  );
}

function secretWordAppears(word: string, gNorms: string[]): boolean {
  if (gNorms.some((g) => g === word || g.startsWith(word))) return true;
  // Inflected verbs: 울었어 ↔ 울었다고, 무서워서 ↔ 무서운
  const chars = Array.from(word);
  if (chars.length < 3) return false;
  const prefix = chars.slice(0, 2).join("");
  if (PREFIX_STOPWORDS.has(prefix)) return false;
  return gNorms.some((g) => hangulLength(g) >= 2 && g.startsWith(prefix));
}

function findSecrets(guardian: string, childTexts: string[]): string[] {
  const spans: string[] = [];
  const gNorms = eojeols(guardian).map((e) => e.norm);
  const gHangul = hangulOnly(guardian);

  for (const msg of childTexts) {
    if (!SECRET_MARKER_RE.test(msg)) continue;

    const content = secretContentWords(msg);
    const matched = content.filter((t) => secretWordAppears(t, gNorms));
    if (matched.length >= 2 || (content.length <= 2 && matched.length >= 1)) {
      spans.push(matched.join(" "));
      continue;
    }

    const core = hangulOnly(
      msg
        .replace(SECRET_MARKER_GLOBAL_RE, " ")
        .replace(SECRET_ADDRESSEE_RE, " ")
    );
    const { length, aStart } = longestCommonSubstring(gHangul, core);
    if (length >= SECRET_MIN_COMMON) {
      spans.push(gHangul.slice(aStart, aStart + length));
    }
  }
  return spans;
}

/* ------------------------------------------------------------------ */
/* third_party_name                                                    */
/* ------------------------------------------------------------------ */

/** Syllables common in Korean given names (2–3 syllable candidates). */
const NAME_SYLLABLES = new Set(
  Array.from(
    "가건결겸경규균근기나남다단담대도동두라란람래려련령로루류륜률리린림명문미민범별보봄빈빛상새서석선설성세소솔송수숙순슬승시신아안애양언연영예오온완요용우욱운웅원위유윤율은의이익인일자재정제조종주준중지진찬창채철초춘충치태택하한해헌혁현형혜호홍화환효후훈휘희"
  )
);

const SURNAMES = new Set(
  Array.from(
    "김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉"
  )
);

/** Roles, kin terms, pronouns and everyday nouns that look like names. */
const NAME_STOPWORDS = new Set([
  "엄마",
  "아빠",
  "어머니",
  "아버지",
  "부모",
  "부모님",
  "할머니",
  "할머님",
  "할아버지",
  "이모",
  "이모부",
  "고모",
  "고모부",
  "삼촌",
  "외삼촌",
  "숙모",
  "사촌",
  "언니",
  "오빠",
  "누나",
  "형",
  "형아",
  "동생",
  "막내",
  "친구",
  "친구들",
  "짝꿍",
  "단짝",
  "선배",
  "후배",
  "반장",
  "선생",
  "선생님",
  "쌤",
  "담임",
  "간호사",
  "의사",
  "교수",
  "교수님",
  "원장",
  "원장님",
  "주치의",
  "간병인",
  "보호자",
  "가족",
  "식구",
  "사람",
  "사람들",
  "아이",
  "아이들",
  "애들",
  "아기",
  "애기",
  "우리",
  "저희",
  "너희",
  "누구",
  "아무",
  "모두",
  "다들",
  "여자",
  "남자",
  "주인",
  "주인공",
  "베디",
  "강아지",
  "고양이",
  "멍멍이",
  "야옹이",
  "인형",
  "하루",
  "하나",
  "다시",
  "이유",
  "정도",
  "대화",
  "수다",
  "재미",
  "용기",
  "기운",
  "기대",
  "소원",
  "기도",
  "지도",
  "미소",
  "수영",
  "우유",
  "두유",
  "나라",
  "미래",
  "소리",
  "주제",
  "정리",
  "인기",
  "성인",
  "영화",
  "보람",
  "이번",
  "진짜",
  "정말",
  "오늘",
  "내일",
  "어제",
  "지금",
  "요즘",
  "가운",
  "주연",
  "도움",
  "하늘",
  "이상",
  "연기",
  "상처",
  "수업",
  "시간",
  "이전",
  "이후",
  "조금",
  "오전",
  "오후",
  "정오",
  "이제",
  "이미",
  "제일",
  "서로",
  "아주",
  "숙제",
  "창문",
  "정원",
  "일기",
  "동화",
  "영상",
  "운동",
  "자신",
  "자기",
  "주위",
  "동안",
  "위로",
  "안정",
  "상태",
  "주의",
  "의미",
  "이해",
  "인정",
  "신호",
  "우선",
  "지지",
  "소중",
  "우정",
  "치유",
]);

/** Particle tails that follow a person's name in an eojeol. */
const PERSON_PARTICLES = new Set([
  "이랑",
  "랑",
  "이랑도",
  "랑도",
  "이랑은",
  "랑은",
  "이하고",
  "하고",
  "이한테",
  "한테",
  "이한테도",
  "한테도",
  "한테는",
  "에게",
  "에게는",
  "에게도",
  "께",
  "께서",
  "이가",
  "가",
  "이는",
  "는",
  "은",
  "이도",
  "도",
  "이를",
  "를",
  "을",
  "이의",
  "의",
  "와",
  "과",
  "와는",
  "과는",
  "이야",
  "야",
  "아",
  "이네",
  "네",
  "이처럼",
  "처럼",
  "이라는",
  "라는",
  "이란",
  "란",
  "씨",
  "군",
  "양",
  "님",
  "이",
]);

const TITLE_WORDS = new Set([
  "간호사",
  "간호사님",
  "선생님",
  "쌤",
  "의사",
  "교수님",
  "원장님",
  "주치의",
  "간병인",
  "언니",
  "오빠",
  "누나",
  "형",
]);

const MASKED_NAME_RE = /([가-힣])(?:OO|○○|◯◯|ㅇㅇ|XX|xx|\*\*|00)/g;

function looksLikeName(stem: string): boolean {
  if (NAME_STOPWORDS.has(stem)) return false;
  const chars = Array.from(stem);
  if (chars.length === 2) {
    return chars.every((c) => NAME_SYLLABLES.has(c));
  }
  if (chars.length === 3) {
    return (
      SURNAMES.has(chars[0]!) &&
      NAME_SYLLABLES.has(chars[1]!) &&
      NAME_SYLLABLES.has(chars[2]!)
    );
  }
  return false;
}

/** 지훈이 → 지훈 ; 김민지 → 김민지 + 민지 */
function nameForms(stem: string): string[] {
  const chars = Array.from(stem);
  if (chars.length === 3 && chars[2] === "이" && hasBatchim(chars[1]!)) {
    return [chars.slice(0, 2).join("")];
  }
  if (chars.length === 3 && SURNAMES.has(chars[0]!)) {
    const given = chars.slice(1).join("");
    return NAME_STOPWORDS.has(given) ? [stem] : [stem, given];
  }
  return [stem];
}

function canonicalMask(text: string): string {
  return text.replace(MASKED_NAME_RE, (_m, first: string) => `${first}OO`);
}

function extractNameCandidates(childTexts: string[]): string[] {
  const out = new Set<string>();
  for (const raw of childTexts) {
    const msg = canonicalMask(raw);
    for (const m of Array.from(msg.matchAll(/[가-힣]OO/g))) out.add(m[0]);

    const tokens = msg
      .split(TOKEN_SPLIT_RE)
      .filter((t) => t && /[가-힣]/.test(t));
    tokens.forEach((tok, i) => {
      const chars = Array.from(tok);
      // 1) name + person particle: 민지랑, 지훈이한테, 김민지가
      for (const len of [3, 2]) {
        if (chars.length <= len) continue;
        const stem = chars.slice(0, len).join("");
        const rest = chars.slice(len).join("");
        if (PERSON_PARTICLES.has(rest) && looksLikeName(stem)) {
          for (const form of nameForms(stem)) out.add(form);
          return;
        }
      }
      // 2) bare name before a title or after 친구: 박지훈 선생님, 친구 민지
      const next = tokens[i + 1] ?? "";
      const prev = tokens[i - 1] ?? "";
      const titled = Array.from(TITLE_WORDS).some((t) => next.startsWith(t));
      const afterFriend = prev === "친구" || prev === "내친구";
      if ((titled || afterFriend) && looksLikeName(tok)) {
        for (const form of nameForms(tok)) out.add(form);
      }
    });
  }
  return Array.from(out);
}

/** 지원해 주세요 / 지원하는 — a verb, not the friend 지원 */
const VERB_TAIL_RE = /^(?:하|해|했|할|합|함|히|한(?!테))/;

function findNames(guardian: string, childTexts: string[]): string[] {
  const candidates = extractNameCandidates(childTexts);
  if (!candidates.length) return [];
  const text = canonicalMask(guardian);
  const spans: string[] = [];
  for (const name of candidates) {
    let from = 0;
    while (from <= text.length) {
      const at = text.indexOf(name, from);
      if (at < 0) break;
      const before = at > 0 ? text[at - 1]! : "";
      const after = text.slice(at + name.length);
      if ((!before || !isHangulSyllable(before)) && !VERB_TAIL_RE.test(after)) {
        spans.push(name);
        break;
      }
      from = at + 1;
    }
  }
  return spans;
}

/* ------------------------------------------------------------------ */
/* location                                                            */
/* ------------------------------------------------------------------ */

const PROVINCES =
  "서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청북|충청남|충북|충남|전라북|전라남|전북|전남|경상북|경상남|경북|경남|제주";

const LOCATION_RES: RegExp[] = [
  // 703호, 1203호실 (not 1호선 / 3호기 / 2호차 / 1호점)
  /\d{2,4}\s?호(?!선|기|차|점)/g,
  // 7층, 지하 1층
  /(?:지하\s?)?\d{1,3}\s?층/g,
  // 5병동, B병동
  /(?:\d{1,3}|[A-Za-z])\s?병동/g,
  // 3번 침대
  /\d{1,3}\s?번\s?(?:침대|베드|병상)/g,
  // 서울시 강남구, 경기도 성남시
  new RegExp(
    `(?:${PROVINCES})(?:특별자치시|특별자치도|특별시|광역시|도|시)?\\s?[가-힣]{1,4}(?:구|군|시)(?![가-힣])`,
    "g"
  ),
  // 역삼동 123-4, 신촌리 5번지
  /[가-힣]{1,6}(?:동|읍|면|리)\s?\d{1,5}(?:-\d{1,5}|\s?번지)/g,
  // 테헤란로 123, 연세로 50-1, 세종대로 110 (not 앞으로 3일)
  /[가-힣\d]{1,12}(?<!으)(?:로|길)\s?\d{1,4}(?:번?길)?(?:-\d{1,4})?(?=$|[\s,.)\]])/g,
  // 37.5665, 126.9780
  /-?\d{1,2}\.\d{1,8}\s*[,/]\s*-?\d{2,3}\.\d{1,8}/g,
  /위도|경도|GPS|좌표/gi,
];

function findLocations(guardian: string): string[] {
  const spans: string[] = [];
  for (const re of LOCATION_RES) {
    re.lastIndex = 0;
    for (const m of Array.from(guardian.matchAll(re))) spans.push(m[0].trim());
  }
  return spans;
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

export function detectLeak(
  guardianText: string,
  childMessages: string[]
): LeakCheck {
  const guardian = normalize(guardianText);
  if (!guardian) return { leak: false, types: [], spans: [] };

  const childTexts = (childMessages ?? [])
    .map((m) => normalize(String(m ?? "")))
    .filter(Boolean);

  const found = new Map<LeakType, string[]>();
  const add = (type: LeakType, spans: string[]) => {
    const kept = spans.map((s) => s.trim()).filter(Boolean);
    if (kept.length) found.set(type, kept);
  };

  if (childTexts.length) {
    add("verbatim", findVerbatim(guardian, childTexts));
    add("quote", findQuotes(guardian, childTexts));
    add("secret", findSecrets(guardian, childTexts));
    add("third_party_name", findNames(guardian, childTexts));
  }
  add("location", findLocations(guardian));

  const types = TYPE_ORDER.filter((t) => found.has(t));
  const spans = Array.from(
    new Set(types.flatMap((t) => found.get(t) ?? []))
  ).slice(0, MAX_SPANS);
  return { leak: types.length > 0, types, spans };
}

/**
 * Return `fallback` instead of `guardianText` when it would leak.
 * The check always describes the original text.
 */
export function guardGuardianText(
  guardianText: string,
  childMessages: string[],
  fallback: string
): { text: string; check: LeakCheck } {
  const check = detectLeak(guardianText, childMessages);
  return { text: check.leak ? fallback : guardianText, check };
}
