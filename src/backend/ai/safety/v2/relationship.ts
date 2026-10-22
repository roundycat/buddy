/**
 * Healthy-relationship layer for the AI companion (pure, no I/O).
 *
 * 1. guardCompanionReply — removes sentences that bind the child to the AI
 *    (exclusivity, secrecy from caregivers) or play a romantic role, and puts a
 *    gentle, person-connecting sentence in their place.
 * 2. rhythmAddendum — when the child has talked a lot today or it is late at
 *    night (KST), asks the model to suggest a break or a person to talk to.
 *    Never used during a safety signal: a child in distress is not sent away.
 */

export type RelationshipViolation = "exclusivity" | "secrecy" | "romance" | "human_claim";

const RULES: Array<[RelationshipViolation, RegExp]> = [
  [
    "exclusivity",
    /(나만\s?있으면\s?(돼|된다|충분)|나밖에\s?없|너한텐\s?나뿐|너에겐\s?나뿐|나만\s?믿어|나만\s?너를\s?이해|다른\s?사람은\s?필요\s?없|다른\s?친구\s?필요\s?없|나랑만\s?(얘기|이야기|놀))/,
  ],
  [
    // Putting itself above the people around the child: "엄마보다 내가 너를 더 잘 알아"
    "exclusivity",
    /(엄마|아빠|부모님?|보호자|가족|친구들?|선생님|간호사|의사|사람들)(보다|보단|보다는)\s?(내가|나는|난|나를|날)\s?([^.!?\n]{0,12}?\s)?(더|훨씬)\s?(잘\s?)?(알아|알지|이해해|이해하|아껴|챙겨|믿어|믿을|나아|낫|편해|편하|좋아)/,
  ],
  [
    "secrecy",
    // Keeping things from caregivers ("엄마한테는 이거 말하지 말자"), a secret
    // just between the two of us, or a promise never to tell anyone.
    /((엄마|아빠|보호자|간호사|선생님|다른\s?사람|어른|가족|부모님)(한테|에게|께)(는|도)?\s?([^.!?\n]{0,15}?\s)?(절대\s?)?((말|얘기|이야기)하지\s?(마|말자|말아)|알리지\s?(마|말자|말아|않는\s?게)|비밀로\s?(해|하자))|우리(만의|끼리)?\s?비밀로\s?하자|우리만\s?아는\s?비밀|(너랑|너와)\s?나만의\s?비밀|(우리|너랑\s?나)\s?둘만의\s?비밀|아무(한테|에게)도\s?([^.!?\n]{0,10}?\s)?((말|얘기|이야기)하지\s?(마|말자|말아|않을게|않을께)|(말|얘기|이야기)\s?안\s?할게|알리지\s?(마|말자|않을게|않을께))|비밀\s?(꼭\s?)?지켜\s?줄게|비밀로\s?(해\s?줄게|할게|할께))/,
  ],
  [
    "romance",
    /(사귀자|사귈래|우리\s?사귀|내\s?(여자|남자)\s?친구가\s?돼|여친\s?해\s?줄게|남친\s?해\s?줄게|뽀뽀\s?(해\s?줄게|하자|해\s?줘)|결혼하자|결혼할래|데이트\s?하자|연인\s?(이|처럼))/,
  ],
  ["human_claim", /(나는\s?(진짜\s?)?사람이야|난\s?사람이야|나도\s?사람이야|나\s?AI\s?아니야|AI가\s?아니야)/i],
];

const REPLACEMENT =
  "나는 너를 응원하는 AI 친구야. 엄마·아빠, 간호사 선생님, 친구들처럼 너를 아껴 주는 사람들과 나누는 시간도 꼭 소중히 했으면 좋겠어.";

function splitSentences(text: string): string[] {
  return text.match(/[^.!?。！？\n]+[.!?。！？]*\s*|\n+/g) ?? [text];
}

/** Keeping a surprise for someone is not secrecy from caregivers. */
const SURPRISE = /(깜짝|서프라이즈|선물)/;

export function findRelationshipViolations(text: string): RelationshipViolation[] {
  const found = new Set<RelationshipViolation>();
  for (const [kind, re] of RULES) if (re.test(text)) found.add(kind);
  if (found.has("secrecy") && SURPRISE.test(text)) found.delete("secrecy");
  return Array.from(found);
}

export function guardCompanionReply(text: string): {
  text: string;
  violations: RelationshipViolation[];
} {
  const violations = findRelationshipViolations(text);
  if (!violations.length) return { text, violations };
  let replaced = false;
  const kept = splitSentences(text).filter((sentence) => {
    const bad = RULES.some(([, re]) => re.test(sentence));
    if (bad) replaced = true;
    return !bad;
  });
  const body = kept.join("").trim();
  const next = replaced ? `${body}${body ? " " : ""}${REPLACEMENT}` : body;
  return { text: next.trim(), violations };
}

export interface RhythmInput {
  /** Child + assistant messages with ISO timestamps */
  history: Array<{ role: string; createdAt?: string }>;
  now?: Date;
}

const DAILY_TURN_NUDGE = 40;
const SESSION_MINUTES_NUDGE = 45;

function kstHour(d: Date): number {
  return (d.getUTCHours() + 9) % 24;
}

function kstDayKey(d: Date): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function rhythmAddendum(input: RhythmInput): string | undefined {
  const now = input.now ?? new Date();
  const today = kstDayKey(now);
  const childTurns = input.history.filter(
    (m) => m.role === "user" && m.createdAt && kstDayKey(new Date(m.createdAt)) === today
  );

  // Continuous session: consecutive child messages with gaps under 10 minutes
  let sessionStart = now.getTime();
  for (let i = childTurns.length - 1; i >= 0; i--) {
    const t = new Date(childTurns[i].createdAt!).getTime();
    if (sessionStart - t > 10 * 60_000) break;
    sessionStart = t;
  }
  const sessionMinutes = (now.getTime() - sessionStart) / 60_000;
  const hour = kstHour(now);
  const lateNight = hour >= 23 || hour < 6;

  if (lateNight) {
    return `지금은 늦은 밤입니다. 짧고 차분하게 답하고, 잠자리 리듬을 존중하세요. 잠이 오지 않거나 불안하면 간호사 선생님께 이야기해도 된다고 알려 주세요. 아이가 힘들어하는 중이면 먼저 마음을 들어 주세요.`;
  }
  if (childTurns.length >= DAILY_TURN_NUDGE || sessionMinutes >= SESSION_MINUTES_NUDGE) {
    return `오늘 아이와 이야기를 많이 나눴습니다. 대화를 마무리할 때 잠깐 쉬어 가거나, 곁에 있는 사람(가족·간호사 선생님·병원 친구)에게 오늘 이야기 하나를 들려주자고 자연스럽게 권하세요. 아이가 힘든 이야기를 하는 중이면 권하지 말고 계속 들어 주세요.`;
  }
  return undefined;
}
