import "server-only";
import { getLlmProvider } from "@/backend/shared/llm";
import type { ParentEmpathyGuide } from "./parent.types";

/**
 * Privacy-safe child traits from onboarding (self survey).
 * Used to personalize activities — never for diagnosis.
 */
export interface EmpathyChildProfile {
  disposition?: string;
  mbti?: string;
  hobbies?: string;
  favoriteHobby?: string;
  stressRelief?: string;
  favoriteFood?: string;
  mainActivity?: string;
  /** How the child prefers companion interaction */
  interaction?: string;
  energy?: string;
}

/**
 * Context retrieved for empathy coaching.
 * Production: Amazon OpenSearch kNN over memory embeddings.
 * Current: privacy-safe aggregate retrieval (RAG-shaped contract).
 */
export interface EmpathyRagContext {
  childName: string;
  moodLabel: string | null;
  themes: string[];
  memorySummary: string;
  scheduleTitles: string[];
  completedAdventures: string[];
  memoryHighlights: string[];
  dayStoryHint: string | null;
  childProfile: EmpathyChildProfile;
  sources: string[];
}

export function childProfileFingerprint(profile: EmpathyChildProfile): string {
  return [
    profile.disposition,
    profile.mbti,
    profile.hobbies,
    profile.favoriteHobby,
    profile.stressRelief,
    profile.favoriteFood,
    profile.mainActivity,
    profile.interaction,
    profile.energy,
  ]
    .map((v) => (v ?? "").trim())
    .join("|");
}

function personalizedActivities(ctx: EmpathyRagContext): string[] {
  const hobby =
    ctx.childProfile.favoriteHobby?.trim() ||
    ctx.childProfile.hobbies?.split(/[,/·]/)[0]?.trim();
  const stress = ctx.childProfile.stressRelief?.trim();
  const food = ctx.childProfile.favoriteFood?.trim();
  const items: string[] = [];

  if (hobby) {
    items.push(`좋아하는 “${hobby}” 이야기를 짧게 나눠 보기`);
  }
  if (stress) {
    items.push(`평소 힘 뺄 때처럼 “${stress}”를 함께 해 보기`);
  }
  if (food) {
    items.push(`좋아하는 “${food}” 이야기를 하며 기분 전환하기`);
  }
  if (ctx.completedAdventures[0]) {
    items.push(`오늘 해낸 “${ctx.completedAdventures[0]}”을(를) 칭찬해 주기`);
  }

  const defaults = [
    "창밖이나 하늘을 함께 잠시 바라보기",
    "좋아하는 짧은 음악·동화를 같이 듣기",
    "손잡고 1분만 조용히 앉아 있기",
  ];
  for (const d of defaults) {
    if (items.length >= 3) break;
    items.push(d);
  }
  return items.slice(0, 3);
}

export function buildEmpathyFallback(
  ctx: EmpathyRagContext,
  dateKey: string
): ParentEmpathyGuide {
  const hasExam = ctx.scheduleTitles.length > 0;
  const disposition = ctx.childProfile.disposition?.trim();
  const tired =
    ctx.moodLabel?.includes("피곤") ||
    ctx.moodLabel?.includes("슬프") ||
    ctx.themes.some((t) => /불안|걱정|무서|피곤|슬프/.test(t));

  const quiet =
    disposition?.includes("내향") ||
    disposition?.includes("조용") ||
    ctx.childProfile.interaction === "quiet" ||
    ctx.childProfile.interaction === "listen";

  return {
    dateKey,
    emotionalSummary: hasExam
      ? `오늘 병원 일정(${ctx.scheduleTitles.slice(0, 2).join(", ")})이 있어, ${ctx.childName}에게 긴장이 남을 수 있어요.`
      : tired
        ? `오늘은 ${ctx.childName}의 마음에 조금 더 세심한 온기가 필요할 수 있어요.`
        : disposition
          ? `${ctx.childName}의 “${disposition}” 성향을 존중하며, 오늘 하루를 천천히 곁에서 지켜봐 주세요.`
          : `오늘 ${ctx.childName}의 하루를 천천히 들어 주는 것만으로도 큰 힘이 됩니다.`,
    empathyCoaching: {
      avoidSaying: quiet
        ? "왜 말 안 해? 빨리 말해 봐."
        : "괜찮아, 별일 아니야.",
      trySaying: quiet
        ? "말하기 싫으면 괜찮아요. 옆에만 있을게."
        : "많이 긴장됐구나. 네 마음 내가 들어 줄게.",
      why: quiet
        ? "조용한 아이일수록, 침묵을 존중받는 느낌이 안정을 줍니다."
        : "감정을 인정해 주면 아이가 혼자가 아니라고 느껴요.",
    },
    thingsToDo: personalizedActivities(ctx),
    thingsToAvoid: [
      "치료·검사 직후 바로 많은 질문 던지기",
      "감정을 가볍게 넘기기",
      quiet
        ? "대답을 재촉하거나 대화를 억지로 이어가기"
        : "꼭 대답하게 재촉하기",
    ],
    encouragingMessage:
      "작은 공감의 순간들이, 아이에게는 가장 든든한 힘이 됩니다.",
    sources: ctx.sources,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Retrieve privacy-safe context for empathy coaching.
 * TODO [AWS OpenSearch]: embed memory/schedule summaries and kNN retrieve.
 */
export function retrieveEmpathyContext(input: {
  childName: string;
  moodLabel: string | null;
  themes: string[];
  memorySummary: string;
  scheduleTitles: string[];
  completedAdventures: string[];
  memoryCaptions: string[];
  dayStoryHint: string | null;
  childProfile?: EmpathyChildProfile;
}): EmpathyRagContext {
  const childProfile: EmpathyChildProfile = {
    disposition: input.childProfile?.disposition?.trim() || undefined,
    mbti: input.childProfile?.mbti?.trim() || undefined,
    hobbies: input.childProfile?.hobbies?.trim() || undefined,
    favoriteHobby: input.childProfile?.favoriteHobby?.trim() || undefined,
    stressRelief: input.childProfile?.stressRelief?.trim() || undefined,
    favoriteFood: input.childProfile?.favoriteFood?.trim() || undefined,
    mainActivity: input.childProfile?.mainActivity?.trim() || undefined,
    interaction: input.childProfile?.interaction?.trim() || undefined,
    energy: input.childProfile?.energy?.trim() || undefined,
  };

  const sources: string[] = [];
  if (input.moodLabel) sources.push("오늘의 감정");
  if (input.themes.length) sources.push("최근 대화 테마");
  if (input.scheduleTitles.length) sources.push("오늘 병원 일정");
  if (input.completedAdventures.length) sources.push("완료한 활동");
  if (input.memoryCaptions.length) sources.push("오늘의 기억");
  if (input.memorySummary.trim()) sources.push("학습된 관계 요약");
  if (
    childProfile.disposition ||
    childProfile.hobbies ||
    childProfile.favoriteHobby ||
    childProfile.stressRelief
  ) {
    sources.push("아이 성향·취향");
  }

  return {
    childName: input.childName,
    moodLabel: input.moodLabel,
    themes: input.themes.slice(0, 4),
    memorySummary: input.memorySummary.slice(0, 600),
    scheduleTitles: input.scheduleTitles.slice(0, 5),
    completedAdventures: input.completedAdventures.slice(0, 4),
    memoryHighlights: input.memoryCaptions.slice(0, 4),
    dayStoryHint: input.dayStoryHint?.slice(0, 120) ?? null,
    childProfile,
    sources: sources.length ? sources : ["일반 돌봄 가이드"],
  };
}

function extractGuideJson(raw: string): Partial<ParentEmpathyGuide> | null {
  const text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? text).trim();
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as Partial<ParentEmpathyGuide>;
    } catch {
      return null;
    }
  };
  const direct = tryParse(body);
  if (direct) return direct;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) return tryParse(body.slice(start, end + 1));
  return null;
}

/**
 * Bedrock-backed empathy guide. Never diagnostic.
 */
export async function composeEmpathyGuideWithLlm(
  ctx: EmpathyRagContext,
  dateKey: string
): Promise<ParentEmpathyGuide> {
  const fallback = buildEmpathyFallback(ctx, dateKey);

  try {
    const llm = getLlmProvider();
    if (llm.name === "mock") return fallback;

    const result = await llm.chat({
      temperature: 0.55,
      maxTokens: 750,
      messages: [
        {
          role: "system",
          content: `당신은 장기 입원 아동의 보호자를 돕는 Beddy 공감 코치입니다.

역할:
- 진단·병명·예후·약물·임상 평가를 절대 하지 마세요.
- 의료진을 대체하지 마세요.
- 원문 대화·비밀 일기를 인용하지 마세요.
- 아이 성향·취미·스트레스 해소법·선호 상호작용이 있으면 thingsToDo와 대화 제안에 반드시 반영하세요.
- 취미가 있으면 “함께하면 좋은 일”에 그 취향을 구체화하세요.
- 내향/조용한 성향이면 재촉하지 않는 제안을 우선하세요.
- 요약 지표만으로 “오늘의 공감 가이드”를 작성하세요.
- 문장은 부드럽고 실천 가능한 한국어 존댓말.

반드시 JSON만 반환:
{
  "emotionalSummary": "오늘 마음 요약 1~2문장 (비진단)",
  "empathyCoaching": {
    "avoidSaying": "피하면 좋은 말 한 줄",
    "trySaying": "대신 해보면 좋은 말 한 줄",
    "why": "왜 도움이 되는지 한 줄"
  },
  "thingsToDo": ["함께 할 일 2~3개 — 가능하면 취미/취향 반영"],
  "thingsToAvoid": ["피하면 좋은 것 2~3개"],
  "encouragingMessage": "보호자를 위한 따뜻한 한 문장"
}`,
        },
        {
          role: "user",
          content: `RAG로 모은 오늘의 맥락(JSON):\n${JSON.stringify(
            {
              dateKey,
              childName: ctx.childName,
              moodLabel: ctx.moodLabel,
              themes: ctx.themes,
              scheduleTitles: ctx.scheduleTitles,
              completedAdventures: ctx.completedAdventures,
              memoryHighlights: ctx.memoryHighlights,
              dayStoryHint: ctx.dayStoryHint,
              childProfile: ctx.childProfile,
              learnedMemory: ctx.memorySummary,
              sources: ctx.sources,
            },
            null,
            2
          )}\n\n오늘의 공감 가이드 JSON:`,
        },
      ],
    });

    const parsed = extractGuideJson(result.content ?? "");
    if (!parsed?.emotionalSummary || !parsed.empathyCoaching) {
      return fallback;
    }

    const coaching =
      parsed.empathyCoaching as ParentEmpathyGuide["empathyCoaching"];
    const thingsToDo = Array.isArray(parsed.thingsToDo)
      ? parsed.thingsToDo.map(String).filter(Boolean).slice(0, 3)
      : fallback.thingsToDo;
    const thingsToAvoid = Array.isArray(parsed.thingsToAvoid)
      ? parsed.thingsToAvoid.map(String).filter(Boolean).slice(0, 3)
      : fallback.thingsToAvoid;

    return {
      dateKey,
      emotionalSummary: String(parsed.emotionalSummary).trim().slice(0, 220),
      empathyCoaching: {
        avoidSaying: String(
          coaching.avoidSaying ?? fallback.empathyCoaching.avoidSaying
        )
          .trim()
          .slice(0, 80),
        trySaying: String(
          coaching.trySaying ?? fallback.empathyCoaching.trySaying
        )
          .trim()
          .slice(0, 100),
        why: String(coaching.why ?? fallback.empathyCoaching.why)
          .trim()
          .slice(0, 120),
      },
      thingsToDo: thingsToDo.length >= 2 ? thingsToDo : fallback.thingsToDo,
      thingsToAvoid:
        thingsToAvoid.length >= 2 ? thingsToAvoid : fallback.thingsToAvoid,
      encouragingMessage: String(
        parsed.encouragingMessage ?? fallback.encouragingMessage
      )
        .trim()
        .slice(0, 160),
      sources: ctx.sources,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("[parent-empathy] Bedrock guide skipped", error);
    return fallback;
  }
}
