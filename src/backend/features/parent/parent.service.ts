import "server-only";
import { todayKey } from "@/backend/shared/time/date";
import {
  formatMemoryForPrompt,
  getConversationMemory,
} from "@/backend/features/conversation/conversation.store";
import { getGardenAccount } from "@/backend/features/emotion-garden/emotion-garden.store";
import { MOOD_OPTIONS } from "@/backend/features/emotion-garden/emotion-garden.service";
import type { MoodId } from "@/backend/features/emotion-garden/emotion-garden.types";
import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import { getWishTreeAccount } from "@/backend/features/wish-tree/wish-tree.store";
import { getAdventurePack } from "@/backend/features/adventure-quest/adventure-quest.store";
import { getAdventureQuest } from "@/backend/features/adventure-quest/adventure-quest.service";
import { listDayStoriesForUser } from "@/backend/features/adventure-quest/adventure-story.service";
import { getMemoryTimeline } from "@/backend/features/memory-timeline/memory-timeline.service";
import { resolveLinkedChildUserId } from "@/backend/features/guardian-link/guardian-link.service";
import { hasLedgerRef } from "@/backend/features/wallet/wallet.store";
import { runLlm } from "@/backend/ai/orchestrator";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import { env } from "@/backend/shared/config/env";
import {
  getParentSettings,
  saveParentSettings,
} from "./parent-settings.store";
import {
  getStoredEmpathyGuide,
  saveEmpathyGuide,
} from "./parent-empathy-guide.store";
import { getPreparedParentSummary } from "./parent-daily-prep.store";
import {
  buildEmpathyFallback,
  composeEmpathyGuideWithLlm,
  childProfileFingerprint,
  retrieveEmpathyContext,
  type EmpathyChildProfile,
} from "./parent-empathy-guide.llm";
import { listScheduleForChild } from "@/backend/features/hospital-day/hospital-day.store";
import { autoCompleteDueScheduleItems } from "@/backend/features/hospital-day/hospital-day.service";
import { listParentChildMedia } from "./parent-media.service";
import { resolveGuardianSharing } from "./parent-sharing.service";
import {
  getActiveChildSafetyAlert,
  type ChildSafetyAlert,
} from "@/backend/features/safety/safety-alert.store";
import {
  formatKbHitsForPrompt,
  kbSourceLabels,
  type KbHit,
} from "@/backend/ai/kb/retrieve";
import { retrieveGuardianContext } from "@/backend/ai/rag/guardian-rag";
import { detectLeak, guardGuardianText } from "@/backend/ai/bridge/leak-guard";
import { recentChildWording } from "@/backend/ai/bridge/child-wording";
import { isChildConsentPending } from "@/backend/features/consent/consent.guard";
import { getGuardianConsentView } from "@/backend/features/consent/consent.service";
import { getChildShareChoices } from "@/backend/features/sharing/sharing.service";
import {
  decideShare,
  guardianVisibilityKey,
} from "@/backend/features/sharing/share-policy";
import { listSharedConcernNotices } from "@/backend/features/sharing/concern-request.service";
import type {
  ParentCalendarDay,
  ParentCalendarMark,
  ParentCareSuggestion,
  ParentEmotionOverview,
  ParentEmpathyGuide,
  ParentHomeDashboard,
  ParentMediaItem,
  ParentMemoryHighlight,
  ParentMoodTone,
  ParentProfileResponse,
  ParentReportAnswer,
  ParentReportResponse,
  ParentSafetyAlert,
  ParentSharingFlags,
  ParentTimelineEntry,
  ParentTimelineResponse,
  ParentTimelineScheduleItem,
} from "./parent.types";

function moodMeta(mood: MoodId | null) {
  return mood ? MOOD_OPTIONS.find((m) => m.id === mood) ?? null : null;
}

function toneFromMood(mood: MoodId | null): ParentMoodTone {
  if (!mood) return "mixed";
  if (mood === "happy" || mood === "love") return "warm";
  if (mood === "sleepy") return "calm";
  if (mood === "sad") return "tired";
  if (mood === "angry") return "brave";
  return "mixed";
}

function dayLabelFromKey(dateKey: string) {
  const parts = dateKey.split("-").map(Number);
  const m = parts[1];
  const d = parts[2];
  if (!m || !d) return dateKey;
  return `${m}/${d}`;
}

function todayMoodFromGarden(
  flowers: Array<{ mood: MoodId; plantedOn: string }>
): MoodId | null {
  const day = todayKey();
  const today = flowers.find((f) => f.plantedOn === day);
  return today?.mood ?? null;
}

async function resolveChild(guardianUserId: string) {
  const childUserId = await resolveLinkedChildUserId(guardianUserId);
  if (!childUserId) {
    return { linked: false as const, childUserId: null, childName: null as string | null, persona: null };
  }
  const persona = await getPersonaForUser(childUserId);
  const childName =
    persona.self?.nickname?.trim() ||
    persona.profile?.nickname?.trim() ||
    persona.name ||
    "아이";
  return { linked: true as const, childUserId, childName, persona };
}

/** Names that are not third parties for the guardian (child, companion). */
function ownNames(persona: {
  name?: string;
  self?: { nickname?: string } | null;
  profile?: { nickname?: string } | null;
} | null): string[] {
  if (!persona) return [];
  return [persona.self?.nickname, persona.profile?.nickname, persona.name]
    .map((n) => (n ?? "").trim())
    .filter(Boolean);
}

const MINIMAL_SAFETY_SUMMARY =
  "아이에게 도움이 필요할 수 있다는 신호가 있었어요. 곁에서 이야기를 들어 주시고, 필요하면 의료진이나 자살예방 상담전화(109)·응급(119)의 도움을 받아 주세요.";

/** Safety notices reach the guardian as "help is needed" only — never content. */
function toGuardianSafetyAlert(
  alert: ChildSafetyAlert | null,
  childWording: string[]
): ParentSafetyAlert | null {
  if (!alert) return null;
  const { decision } = decideShare({ kind: "safety", crisisLevel: alert.level });
  // protect_route: the crisis module routes elsewhere, never to the guardian
  if (decision !== "minimal") return null;
  return {
    id: alert.id,
    level: alert.level,
    summary: guardGuardianText(
      alert.summary,
      childWording,
      MINIMAL_SAFETY_SUMMARY
    ).text,
    createdAt: alert.createdAt,
  };
}

/** Each field falls back to the template guide when it would leak. */
function guardEmpathyGuide(
  guide: ParentEmpathyGuide,
  childWording: string[],
  fallback: ParentEmpathyGuide
): ParentEmpathyGuide {
  const safe = (text: string, alt: string) =>
    guardGuardianText(text, childWording, alt).text;
  const safeList = (items: string[], alts: string[]) =>
    Array.from(
      new Set(items.map((item, i) => safe(item, alts[i] ?? alts[0] ?? "")))
    ).filter(Boolean);
  return {
    ...guide,
    emotionalSummary: safe(guide.emotionalSummary, fallback.emotionalSummary),
    empathyCoaching: {
      avoidSaying: safe(
        guide.empathyCoaching.avoidSaying,
        fallback.empathyCoaching.avoidSaying
      ),
      trySaying: safe(
        guide.empathyCoaching.trySaying,
        fallback.empathyCoaching.trySaying
      ),
      why: safe(guide.empathyCoaching.why, fallback.empathyCoaching.why),
    },
    thingsToDo: safeList(guide.thingsToDo, fallback.thingsToDo),
    thingsToAvoid: safeList(guide.thingsToAvoid, fallback.thingsToAvoid),
    encouragingMessage: safe(
      guide.encouragingMessage,
      fallback.encouragingMessage
    ),
  };
}

/** Active safety notice for the linked child, under the same minimal rule. */
export async function getParentSafetyAlert(
  guardianUserId: string
): Promise<ParentSafetyAlert | null> {
  const link = await resolveChild(guardianUserId);
  if (!link.linked || !link.childUserId) return null;
  const [alert, childWording] = await Promise.all([
    getActiveChildSafetyAlert(link.childUserId),
    recentChildWording(link.childUserId, {
      exclude: [link.childName, ...ownNames(link.persona)],
    }),
  ]);
  return toGuardianSafetyAlert(alert, childWording);
}

function emptyHome(
  companionNote: string,
  updatedLabel: string
): ParentHomeDashboard {
  return {
    linked: false,
    companionNote,
    child: null,
    todayMessage: null,
    emotion: null,
    adventures: [],
    memories: [],
    media: [],
    dailySummary: null,
    careSuggestions: [],
    empathyGuide: null,
    safetyAlert: null,
    consentGate: null,
    sharing: null,
    concernNotices: [],
    updatedLabel,
  };
}

/**
 * Parent Home — answers “How was my child today?” without private chat.
 * A category appears only when the child shares it AND the guardian's toggle
 * is on; generated text passes the leak guard against the child's own words.
 */
export async function getParentHome(
  guardianUserId: string,
  opts?: { preferPrepared?: boolean }
): Promise<ParentHomeDashboard> {
  const preferPrepared = opts?.preferPrepared !== false;
  const link = await resolveChild(guardianUserId);
  if (!link.linked || !link.childUserId || !link.persona) {
    return emptyHome(
      "아이와 연결하면, 오늘 하루의 마음을 따뜻하게 볼 수 있어요.",
      "연결 전"
    );
  }

  const childId = link.childUserId;
  const childWording = await recentChildWording(childId, {
    exclude: [link.childName, ...ownNames(link.persona)],
  });

  // Under 14 without legal-guardian consent: the consent form comes first.
  if (await isChildConsentPending(childId)) {
    const [consent, safetyAlert] = await Promise.all([
      getGuardianConsentView(guardianUserId),
      getActiveChildSafetyAlert(childId),
    ]);
    return {
      ...emptyHome(
        "보호자 동의가 끝나면 아이의 하루를 볼 수 있어요. 대화 내용은 동의한 뒤에도 보이지 않아요.",
        "동의 전"
      ),
      linked: true,
      safetyAlert: toGuardianSafetyAlert(safetyAlert, childWording),
      consentGate: {
        childName: consent.childName ?? link.childName,
        consentVersion: consent.consentVersion,
      },
    };
  }

  const day = todayKey();
  const settings = await getParentSettings(guardianUserId);
  const sharing = await resolveGuardianSharing(guardianUserId, childId, settings);
  const moodShown = sharing.mood === "shown";
  const adventuresShown = sharing.adventures === "shown";
  const highlightsShown = sharing.memoryHighlights === "shown";
  const mediaShown = sharing.media === "shown";

  // Private categories are not even loaded.
  const [garden, memory, wishes, adventure, scheduleItems, safetyAlert, concernNotices] =
    await Promise.all([
      moodShown ? getGardenAccount(childId) : Promise.resolve(null),
      moodShown ? getConversationMemory(childId) : Promise.resolve(null),
      highlightsShown ? getWishTreeAccount(childId) : Promise.resolve(null),
      adventuresShown ? getAdventureQuest(childId) : Promise.resolve(null),
      listScheduleForChild(childId, day).catch(() => []),
      getActiveChildSafetyAlert(childId),
      listSharedConcernNotices(childId),
    ]);

  const todayMood = garden ? todayMoodFromGarden(garden.flowers) : null;
  const meta = moodMeta(todayMood);
  const hospitalDay = link.persona.dayCount ?? 1;
  // Themes come from chat learning — drop any that carry the child's wording.
  const themes = (memory?.emotionalThemes ?? [])
    .filter((t) => !detectLeak(t, childWording).leak)
    .slice(0, 3);

  const adventuresRaw = adventure
    ? await Promise.all(
        adventure.quests.map(async (q) => {
          const done =
            q.status === "done" || (await hasLedgerRef(childId, q.id));
          return {
            id: q.id,
            title: q.title,
            emoji: q.emoji,
            completed: done,
          };
        })
      )
    : [];

  const adventures = adventuresRaw;
  const completedCount = adventuresRaw.filter((a) => a.completed).length;
  const completedTitles = adventuresRaw
    .filter((a) => a.completed)
    .map((a) => a.title);
  // Guardian-entered schedules are a care action — always theirs to see.
  const schedulesShared =
    decideShare({ kind: "schedule", careAction: true }).decision === "share";
  const scheduleTitles = (scheduleItems ?? [])
    .filter((s) => schedulesShared && s.source === "parent")
    .map((s) => s.title);
  const dayStoryNarrative =
    adventure && highlightsShown ? adventure.dayStory?.narrative ?? null : null;
  const wishCount = wishes?.wishes.length ?? 0;
  const memorySummary =
    memory && highlightsShown ? formatMemoryForPrompt(memory) : "";

  const memoryHighlights = highlightsShown
    ? buildMemoryHighlights({
        moodLabel: meta?.label,
        moodEmoji: meta?.emoji,
        adventureTitles: completedTitles,
        wishCount,
        themes,
        dayStory: dayStoryNarrative?.slice(0, 40) ?? null,
      })
    : [];

  const media: ParentMediaItem[] = mediaShown
    ? await listParentChildMedia(childId)
    : [];

  const summaryInput: ParentSummaryInput = {
    childName: link.childName,
    moodLabel: meta?.label ?? null,
    themes,
    adventureHeadline: adventure?.headline ?? null,
    completedCount,
    totalQuests: adventuresRaw.length,
    wishCount,
    dayStory: dayStoryNarrative?.slice(0, 80) ?? null,
    memorySummary,
  };

  // Dawn batch may already have warmed todayMessage / empathyGuide —
  // only reuse it when it was built with today's sharing choices.
  const visibilityKey = guardianVisibilityKey(sharing);
  const preparedRow = preferPrepared
    ? await getPreparedParentSummary(guardianUserId, day)
    : null;
  const prepared =
    preparedRow?.visibilityKey === visibilityKey ? preparedRow : null;

  const empathyInput = {
    guardianUserId,
    childUserId: childId,
    dateKey: day,
    childName: link.childName,
    moodLabel: meta?.label ?? null,
    themes,
    memorySummary,
    scheduleTitles,
    completedAdventures: completedTitles,
    memoryCaptions: memoryHighlights.map((m) => m.caption),
    dayStoryHint: dayStoryNarrative?.slice(0, 80) ?? null,
    childProfile: buildEmpathyChildProfile(link.persona),
    visibilityKey,
  };

  const [todayMessageText, dailySummaryText, empathyGuide] = await Promise.all([
    prepared?.todayMessage
      ? Promise.resolve(prepared.todayMessage)
      : composeTodayMessageWithLlm(summaryInput),
    settings.notifications.dailyDigest
      ? composeDailySummaryWithLlm(summaryInput)
      : Promise.resolve(null),
    settings.notifications.careTips
      ? prepared?.empathyGuide
        ? Promise.resolve(prepared.empathyGuide)
        : getOrCreateEmpathyGuide(empathyInput)
      : Promise.resolve(null),
  ]);

  // Leak guard — template fallbacks never carry the child's own wording.
  const todayMessageSafe = guardGuardianText(
    todayMessageText,
    childWording,
    buildTodayMessage(summaryInput)
  ).text;
  const dailySummarySafe = dailySummaryText
    ? guardGuardianText(
        dailySummaryText,
        childWording,
        buildDailySummary({
          childName: summaryInput.childName,
          moodLabel: summaryInput.moodLabel,
          themes: summaryInput.themes,
          completed: summaryInput.completedCount,
          total: summaryInput.totalQuests,
          wishCount: summaryInput.wishCount,
        })
      ).text
    : null;
  const empathyGuideSafe = empathyGuide
    ? guardEmpathyGuide(
        empathyGuide,
        childWording,
        buildEmpathyFallback(retrieveEmpathyContext(empathyInput), day)
      )
    : null;

  return {
    linked: true,
    companionNote:
      "대화 내용은 보이지 않아요. 아이가 나누기로 한 오늘의 마음만 부드럽게 보여 드릴게요.",
    child: {
      childName: link.childName,
      hospitalDay,
      moodLabel: moodShown ? meta?.label ?? "아직 기록 전" : "",
      moodEmoji: moodShown ? meta?.emoji ?? "🌱" : "🔒",
      statusLine: !moodShown
        ? sharing.mood === "child_private"
          ? "아이가 오늘의 마음은 아직 나누지 않았어요"
          : "감정 보기가 꺼져 있어요"
        : meta
          ? `오늘은 ${meta.label} 기운이 느껴져요`
          : "아직 오늘의 꽃이 피기 전이에요",
    },
    todayMessage: {
      text: todayMessageSafe,
      generatedAtLabel: "방금 정리됨",
    },
    emotion:
      moodShown && garden
        ? buildEmotionOverview(garden.flowers, todayMood, meta?.label ?? "아직 모름")
        : null,
    adventures,
    memories: memoryHighlights,
    media,
    dailySummary: dailySummarySafe,
    careSuggestions: settings.notifications.careTips
      ? buildCareSuggestions({
          mood: todayMood,
          themes,
          completedAdventures: completedTitles,
        })
      : [],
    empathyGuide: empathyGuideSafe,
    safetyAlert: toGuardianSafetyAlert(safetyAlert, childWording),
    consentGate: null,
    sharing,
    concernNotices,
    updatedLabel: day,
  };
}

async function getOrCreateEmpathyGuide(input: {
  guardianUserId: string;
  childUserId: string;
  dateKey: string;
  childName: string;
  moodLabel: string | null;
  themes: string[];
  memorySummary: string;
  scheduleTitles: string[];
  completedAdventures: string[];
  memoryCaptions: string[];
  dayStoryHint: string | null;
  childProfile: EmpathyChildProfile;
  /** Sharing visibility the guide is built with — part of the cache key */
  visibilityKey: string;
}): Promise<ParentEmpathyGuide> {
  const fingerprint = `${childProfileFingerprint(input.childProfile)}#${input.visibilityKey}`;
  const cached = await getStoredEmpathyGuide(
    input.guardianUserId,
    input.dateKey,
    fingerprint
  );
  if (cached) return cached;

  const ctx = retrieveEmpathyContext({
    childName: input.childName,
    moodLabel: input.moodLabel,
    themes: input.themes,
    memorySummary: input.memorySummary,
    scheduleTitles: input.scheduleTitles,
    completedAdventures: input.completedAdventures,
    memoryCaptions: input.memoryCaptions,
    dayStoryHint: input.dayStoryHint,
    childProfile: input.childProfile,
  });

  const guide = await composeEmpathyGuideWithLlm(ctx, input.dateKey);
  await saveEmpathyGuide({
    guardianUserId: input.guardianUserId,
    childUserId: input.childUserId,
    profileFingerprint: fingerprint,
    guide,
  });
  return guide;
}

/** Child self-survey + interaction prefs for personalized coaching */
function buildEmpathyChildProfile(persona: {
  self?: {
    disposition?: string;
    mbti?: string;
    hobbies?: string;
    favoriteHobby?: string;
    stressRelief?: string;
    favoriteFood?: string;
    mainActivity?: string;
  } | null;
  profile?: {
    disposition?: string;
    mbti?: string;
    hobbies?: string;
    favoriteHobby?: string;
    stressRelief?: string;
    favoriteFood?: string;
    mainActivity?: string;
  } | null;
  energy?: string;
  interaction?: string;
}): EmpathyChildProfile {
  const self = persona.self;
  const fallback = persona.profile;
  return {
    disposition: self?.disposition || fallback?.disposition || undefined,
    mbti: self?.mbti || fallback?.mbti || undefined,
    hobbies: self?.hobbies || fallback?.hobbies || undefined,
    favoriteHobby: self?.favoriteHobby || fallback?.favoriteHobby || undefined,
    stressRelief: self?.stressRelief || fallback?.stressRelief || undefined,
    favoriteFood: self?.favoriteFood || fallback?.favoriteFood || undefined,
    mainActivity: self?.mainActivity || fallback?.mainActivity || undefined,
    energy: persona.energy,
    interaction: persona.interaction,
  };
}

function buildTodayMessage(input: {
  childName: string;
  moodLabel: string | null;
  themes: string[];
  adventureHeadline: string | null;
  completedCount: number;
  wishCount: number;
}) {
  if (input.moodLabel && input.completedCount > 0) {
    return `오늘 ${input.childName}는 ${input.moodLabel} 마음으로, 작은 모험도 ${input.completedCount}가지 해냈어요.`;
  }
  if (input.moodLabel) {
    return `오늘 ${input.childName}의 하루에는 ${input.moodLabel} 기운이 남아 있어요.`;
  }
  if (input.adventureHeadline) {
    return `오늘 ${input.childName}의 모험은 “${input.adventureHeadline}” 쪽이었어요.`;
  }
  if (input.themes[0]) {
    return `요즘 ${input.childName}와 베디가 나누는 이야기에는 “${input.themes[0]}” 느낌이 있어요.`;
  }
  if (input.wishCount > 0) {
    return `${input.childName}의 소원 나무에 꿈이 ${input.wishCount}개 걸려 있어요.`;
  }
  return `오늘 ${input.childName}의 하루는 아직 천천히 채워지는 중이에요. 조금만 기다려 주세요.`;
}

type ParentSummaryInput = {
  childName: string;
  moodLabel: string | null;
  themes: string[];
  adventureHeadline: string | null;
  completedCount: number;
  totalQuests: number;
  wishCount: number;
  dayStory: string | null;
  memorySummary: string;
};

async function composeTodayMessageWithLlm(
  input: ParentSummaryInput
): Promise<string> {
  const fallback = buildTodayMessage({
    childName: input.childName,
    moodLabel: input.moodLabel,
    themes: input.themes,
    adventureHeadline: input.adventureHeadline,
    completedCount: input.completedCount,
    wishCount: input.wishCount,
  });

  try {
    if (env.llmProvider === "mock") return fallback;

    const result = await runLlm({
      feature: "parent.today-summary",
      purpose: "quality",
      childName: input.childName,
      temperature: 0.5,
      maxTokens: 180,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`보호자용 한 줄 요약 작성자입니다.
- 원문 대화·비밀 일기는 절대 인용하지 마세요.
- 요약 지표(감정, 모험 완료, 학습 메모리 요약, 소원)만 사용하세요.
- 한국어 존댓말 1~2문장.`),
        },
        {
          role: "user",
          content: `요약 재료(JSON):\n${JSON.stringify(
            {
              childName: input.childName,
              moodLabel: input.moodLabel,
              themes: input.themes,
              adventureHeadline: input.adventureHeadline,
              completedCount: input.completedCount,
              totalQuests: input.totalQuests,
              wishCount: input.wishCount,
              dayStoryHint: input.dayStory,
              learnedMemory: input.memorySummary,
            },
            null,
            2
          )}\n\n보호자용 오늘의 한 줄:`,
        },
      ],
    });
    const text = result.content?.trim().replace(/^["「]|["」]$/g, "");
    return text && text.length >= 8 ? text.slice(0, 220) : fallback;
  } catch (error) {
    console.warn("[parent-home] today message LLM skipped", error);
    return fallback;
  }
}

async function composeDailySummaryWithLlm(
  input: ParentSummaryInput
): Promise<string> {
  const fallback = buildDailySummary({
    childName: input.childName,
    moodLabel: input.moodLabel,
    themes: input.themes,
    completed: input.completedCount,
    total: input.totalQuests,
    wishCount: input.wishCount,
  });

  try {
    if (env.llmProvider === "mock") return fallback;

    const result = await runLlm({
      feature: "parent.daily-summary",
      purpose: "quality",
      childName: input.childName,
      temperature: 0.45,
      maxTokens: 320,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`보호자용 하루 다이제스트 작성자입니다.
- 감정·활동·완료 모험·하루 기억 요약을 부드럽게 정리하세요.
- 원문 대화는 절대 노출하지 마세요. 학습 메모리 요약만 참고하세요.
- 한국어 존댓말 3~5문장.`),
        },
        {
          role: "user",
          content: `하루 재료(JSON):\n${JSON.stringify(
            {
              childName: input.childName,
              moodLabel: input.moodLabel,
              themes: input.themes,
              adventureHeadline: input.adventureHeadline,
              completedCount: input.completedCount,
              totalQuests: input.totalQuests,
              wishCount: input.wishCount,
              dayStoryHint: input.dayStory,
              learnedMemory: input.memorySummary,
            },
            null,
            2
          )}\n\n보호자용 하루 요약:`,
        },
      ],
    });
    const text = result.content?.trim();
    return text && text.length >= 12 ? text.slice(0, 600) : fallback;
  } catch (error) {
    console.warn("[parent-home] daily summary LLM skipped", error);
    return fallback;
  }
}

function toneScore(tone: ParentMoodTone): number {
  if (tone === "warm") return 88;
  if (tone === "brave") return 76;
  if (tone === "calm") return 64;
  if (tone === "tired") return 34;
  return 50;
}

function lastSevenDateKeys(end = todayKey()): string[] {
  const [y, m, d] = end.split("-").map(Number);
  const base = new Date(y!, m! - 1, d!);
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const cur = new Date(base);
    cur.setDate(base.getDate() - i);
    keys.push(todayKey(cur));
  }
  return keys;
}

function buildEmotionOverview(
  flowers: Array<{ mood: MoodId; plantedOn: string }>,
  todayMood: MoodId | null,
  dominantLabel: string
): ParentEmotionOverview {
  const byDay = new Map(flowers.map((f) => [f.plantedOn, f]));
  const weekKeys = lastSevenDateKeys();

  const weekly = weekKeys.map((dateKey) => {
    const hit = byDay.get(dateKey);
    if (!hit) {
      return {
        dayLabel: dayLabelFromKey(dateKey),
        dateKey,
        tone: "mixed" as const,
        label: "기록 전",
        score: 0,
        empty: true,
      };
    }
    const m = moodMeta(hit.mood);
    const tone = toneFromMood(hit.mood);
    return {
      dayLabel: dayLabelFromKey(dateKey),
      dateKey,
      tone,
      label: m?.label ?? "기록",
      score: toneScore(tone),
      emoji: m?.emoji,
      empty: false,
    };
  });

  const recorded = weekly.filter((p) => !p.empty);
  const countMap = new Map<string, { emoji: string; n: number }>();
  for (const p of recorded) {
    const cur = countMap.get(p.label) ?? { emoji: p.emoji ?? "🌱", n: 0 };
    cur.n += 1;
    countMap.set(p.label, cur);
  }
  const total = recorded.length || 1;
  const distribution = Array.from(countMap.entries())
    .map(([label, v]) => ({
      label,
      emoji: v.emoji,
      percent: Math.round((v.n / total) * 100),
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3);

  const meta = moodMeta(todayMood);
  return {
    dominantLabel,
    dominantEmoji: meta?.emoji ?? "🌱",
    weekly,
    distribution,
  };
}

function buildMemoryHighlights(input: {
  moodLabel?: string;
  moodEmoji?: string;
  adventureTitles: string[];
  wishCount: number;
  themes: string[];
  dayStory: string | null;
}): ParentMemoryHighlight[] {
  const items: ParentMemoryHighlight[] = [];
  if (input.moodLabel) {
    items.push({
      id: "mood",
      kind: "reflection",
      title: "오늘의 꽃",
      caption: input.moodLabel,
      emoji: input.moodEmoji ?? "🌸",
    });
  }
  for (const title of input.adventureTitles.slice(0, 2)) {
    items.push({
      id: `adv-${title}`,
      kind: "mission",
      title: "완료한 모험",
      caption: title,
      emoji: "✅",
    });
  }
  if (input.dayStory) {
    items.push({
      id: "story",
      kind: "drawing",
      title: "하루 이야기",
      caption: input.dayStory,
      emoji: "📖",
    });
  }
  if (input.wishCount > 0) {
    items.push({
      id: "wish",
      kind: "badge",
      title: "소원",
      caption: `꿈 ${input.wishCount}개`,
      emoji: "🌟",
    });
  }
  if (input.themes[0]) {
    items.push({
      id: "theme",
      kind: "reflection",
      title: "마음 키워드",
      caption: input.themes[0],
      emoji: "💬",
    });
  }
  if (items.length === 0) {
    items.push({
      id: "empty",
      kind: "reflection",
      title: "오늘의 기록",
      caption: "아직 모이는 중이에요",
      emoji: "🫧",
    });
  }
  return items.slice(0, 6);
}

function buildDailySummary(input: {
  childName: string;
  moodLabel: string | null;
  themes: string[];
  completed: number;
  total: number;
  wishCount: number;
}) {
  const parts: string[] = [];
  parts.push(
    input.moodLabel
      ? `${input.childName}의 오늘은 ${input.moodLabel} 기운으로 시작됐어요.`
      : `${input.childName}의 오늘 기분은 아직 조용히 기다리고 있어요.`
  );
  if (input.total > 0) {
    parts.push(`작은 모험은 ${input.total}개 중 ${input.completed}개를 마쳤어요.`);
  }
  if (input.themes[0]) {
    parts.push(`이야기 속에는 “${input.themes[0]}” 같은 키워드가 스며 있어요.`);
  }
  if (input.wishCount > 0) {
    parts.push(`소원 나무에는 꿈이 ${input.wishCount}개 반짝이고 있어요.`);
  } else {
    parts.push(`무리하지 않아도 괜찮아요. 천천히 곁에 있어 주는 것만으로도 충분해요.`);
  }
  return parts.slice(0, 4).join(" ");
}

function buildCareSuggestions(input: {
  mood: MoodId | null;
  themes: string[];
  completedAdventures: string[];
}): ParentCareSuggestion[] {
  const list: ParentCareSuggestion[] = [];
  if (input.mood === "sad") {
    list.push({
      id: "hold",
      text: "오늘 힘들었던 순간을 짧게 물어보고, “잘 견뎠다”고 말해 주세요.",
    });
  } else if (input.mood === "happy" || input.mood === "love") {
    list.push({
      id: "celebrate",
      text: "오늘 웃었던 장면을 함께 떠올리며 칭찬해 주세요.",
    });
  } else {
    list.push({
      id: "checkin",
      text: "“오늘 제일 괜찮았던 건 뭐였어?”처럼 가벼운 질문을 건네 보세요.",
    });
  }

  if (input.completedAdventures[0]) {
    list.push({
      id: "adventure",
      text: `오늘 해낸 “${input.completedAdventures[0]}” 이야기를 같이 들어 주세요.`,
    });
  } else {
    list.push({
      id: "draw",
      text: "오늘 그린 그림이나 사진을 함께 보며 이야기를 나눠 보세요.",
    });
  }

  if (input.themes[0]) {
    list.push({
      id: "theme",
      text: `“${input.themes[0]}” 주제로 짧게 이야기해 보면 마음이 이어질 거예요.`,
    });
  } else {
    list.push({
      id: "brave",
      text: "“오늘도 참 잘했어”처럼 용기를 인정해 주는 한마디면 충분해요.",
    });
  }

  return list.slice(0, 3);
}

function monthKeyFromDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonthKey(monthKey: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function monthLabelKo(year: number, month: number) {
  return `${year}년 ${month}월`;
}

function buildMonthGrid(
  year: number,
  month: number,
  dayMeta: Map<
    string,
    {
      marks: ParentCalendarMark[];
      moodEmoji?: string;
    }
  >
): ParentCalendarDay[] {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay(); // 0 Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = todayKey();
  const cells: ParentCalendarDay[] = [];

  const pushDay = (date: Date, inMonth: boolean) => {
    const dateKey = todayKey(date);
    const meta = dayMeta.get(dateKey);
    const marks = meta?.marks ?? [];
    let icon = "🌱";
    if (marks.includes("treatment")) icon = "💉";
    else if (marks.includes("exam")) icon = "🩺";
    else if (marks.includes("adventure")) icon = "⭐";
    else if (marks.includes("mood") && meta?.moodEmoji) icon = meta.moodEmoji;
    else if (!inMonth) icon = "";
    else if (!marks.length) icon = "·";

    cells.push({
      dateKey,
      day: date.getDate(),
      inMonth,
      isToday: dateKey === today,
      marks,
      icon: inMonth ? icon : "·",
      hasContent: inMonth && marks.length > 0,
    });
  };

  // Leading days from previous month
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, -i);
    pushDay(d, false);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    pushDay(new Date(year, month - 1, day), true);
  }
  // Trailing to fill 6 weeks max
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!;
    const [y, m, d] = last.dateKey.split("-").map(Number);
    const next = new Date(y!, m! - 1, d! + 1);
    pushDay(next, false);
  }

  return cells;
}

export async function getParentTimeline(
  guardianUserId: string,
  monthKeyInput?: string
): Promise<ParentTimelineResponse> {
  const parsed =
    (monthKeyInput && parseMonthKey(monthKeyInput)) ||
    parseMonthKey(monthKeyFromDate())!;
  const { year, month } = parsed;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const link = await resolveChild(guardianUserId);
  if (!link.linked || !link.childUserId || !link.persona) {
    return {
      linked: false,
      childName: null,
      monthKey,
      monthLabel: monthLabelKo(year, month),
      calendarDays: buildMonthGrid(year, month, new Map()),
      entries: [],
    };
  }

  const childId = link.childUserId;
  if (await isChildConsentPending(childId)) {
    const consent = await getGuardianConsentView(guardianUserId);
    return {
      linked: true,
      consentRequired: true,
      childName: consent.childName ?? link.childName,
      monthKey,
      monthLabel: monthLabelKo(year, month),
      calendarDays: buildMonthGrid(year, month, new Map()),
      entries: [],
      sharing: null,
    };
  }
  await autoCompleteDueScheduleItems(childId);

  const sharing = await resolveGuardianSharing(guardianUserId, childId);
  const moodShown = sharing.mood === "shown";
  const adventuresShown = sharing.adventures === "shown";
  const highlightsShown = sharing.memoryHighlights === "shown";

  // Only categories the child shares (and the guardian views) are loaded.
  const [gardenAccount, stories, timeline, todayPack, schedules] =
    await Promise.all([
      moodShown ? getGardenAccount(childId) : Promise.resolve(null),
      adventuresShown ? listDayStoriesForUser(childId) : Promise.resolve([]),
      highlightsShown ? getMemoryTimeline(childId) : Promise.resolve(null),
      adventuresShown
        ? getAdventurePack(childId, todayKey())
        : Promise.resolve(null),
      listScheduleForChild(childId),
    ]);
  const garden = { flowers: gardenAccount?.flowers ?? [] };
  const timelineEvents = timeline?.events ?? [];

  const moodByDay = new Map(
    garden.flowers.map((f) => [f.plantedOn, f.mood] as const)
  );
  const storyByDay = new Map(stories.map((s) => [s.date, s] as const));
  const schedulesByDay = new Map<string, ParentTimelineScheduleItem[]>();
  for (const item of schedules) {
    if (item.source !== "parent") continue;
    if (item.type !== "exam" && item.type !== "treatment") continue;
    const list = schedulesByDay.get(item.dateKey) ?? [];
    list.push({
      id: item.id,
      type: item.type,
      title: item.title,
      time: item.time,
      done: item.done,
    });
    schedulesByDay.set(item.dateKey, list);
  }

  const dayMeta = new Map<
    string,
    { marks: ParentCalendarMark[]; moodEmoji?: string }
  >();

  const ensure = (dateKey: string) => {
    if (!dayMeta.has(dateKey)) dayMeta.set(dateKey, { marks: [] });
    return dayMeta.get(dateKey)!;
  };

  for (const f of garden.flowers) {
    const meta = ensure(f.plantedOn);
    if (!meta.marks.includes("mood")) meta.marks.push("mood");
    meta.moodEmoji = moodMeta(f.mood)?.emoji;
  }
  for (const s of stories) {
    const meta = ensure(s.date);
    if (!meta.marks.includes("adventure")) meta.marks.push("adventure");
  }
  if (todayPack) {
    const meta = ensure(todayPack.date);
    if (!meta.marks.includes("adventure")) meta.marks.push("adventure");
  }
  for (const [dateKey, list] of Array.from(schedulesByDay.entries())) {
    const meta = ensure(dateKey);
    if (
      list.some((i: ParentTimelineScheduleItem) => i.type === "exam") &&
      !meta.marks.includes("exam")
    ) {
      meta.marks.push("exam");
    }
    if (
      list.some((i: ParentTimelineScheduleItem) => i.type === "treatment") &&
      !meta.marks.includes("treatment")
    ) {
      meta.marks.push("treatment");
    }
  }

  const calendarDays = buildMonthGrid(year, month, dayMeta);

  const monthPrefix = `${monthKey}-`;
  const dateKeys = new Set<string>();
  for (const key of Array.from(dayMeta.keys())) {
    if (key.startsWith(monthPrefix)) dateKeys.add(key);
  }
  // Always include all days with content in month
  const sorted = Array.from(dateKeys).sort((a, b) => b.localeCompare(a));
  const hospitalDayBase = link.persona.dayCount ?? sorted.length;

  const entries: ParentTimelineEntry[] = sorted.map((dateKey, index) => {
    const mood = moodByDay.get(dateKey) ?? null;
    const meta = moodMeta(mood);
    const story = storyByDay.get(dateKey);
    const dayEvents = timelineEvents.filter((e) => {
      const key = (e.adventureDate || e.occurredAt || "").slice(0, 10);
      return key === dateKey;
    });
    const daySchedules = schedulesByDay.get(dateKey) ?? [];
    const hospitalDay = Math.max(1, hospitalDayBase - index);

    return {
      id: dateKey,
      dateKey,
      dayLabel: dayLabelFromKey(dateKey),
      hospitalDay,
      moodEmoji: meta?.emoji ?? "🌱",
      moodLabel: meta?.label ?? "기록",
      headline:
        story?.headline ??
        dayEvents[0]?.title ??
        (daySchedules[0]
          ? `${daySchedules[0].type === "exam" ? "검사" : "치료"} · ${daySchedules[0].title}`
          : `${link.childName}의 ${hospitalDay}일째 이야기`),
      reflection:
        (highlightsShown ? story?.dayStory?.narrative?.trim() : "") ||
        dayEvents[0]?.summary?.trim() ||
        (daySchedules.length
          ? `이날은 ${daySchedules.map((s) => s.title).join(", ")} 일정이 있었어요.`
          : "그날의 작은 순간들이 차곡차곡 쌓였어요."),
      adventures: story ? story.quests.map((q) => q.title).slice(0, 3) : [],
      memories: dayEvents.slice(0, 3).map((e) => e.title),
      badges: meta ? [`기분 · ${meta.label}`] : [],
      schedules: daySchedules,
    };
  });

  return {
    linked: true,
    childName: link.childName,
    monthKey,
    monthLabel: monthLabelKo(year, month),
    calendarDays,
    entries,
    sharing,
  };
}

const SUGGESTED_QUESTIONS = [
  "이번 주 아이가 가장 행복했던 순간은 뭐였을까요?",
  "아이가 좋아하는 활동은 무엇인가요?",
  "최근 기분 흐름은 어떤가요?",
  "아이가 자주 이야기하는 기억은 무엇인가요?",
  "오늘 아이에게 어떤 말을 건네면 좋을까요?",
  "아이가 조금 힘들었던 순간이 있었나요?",
  "요즘 아이와 베디가 자주 나누는 주제는 뭐예요?",
  "아이의 소원 나무에는 어떤 꿈이 있나요?",
  "오늘 모험은 얼마나 잘 해냈나요?",
  "보호자가 곁에서 해줄 수 있는 작은 응원은?",
];

/** Next chips: exclude the just-asked question, keep a fresh set of 4. */
function pickFollowUpQuestions(exclude: string[] = []): string[] {
  const asked = new Set(exclude.map((q) => q.trim()).filter(Boolean));
  const unused = SUGGESTED_QUESTIONS.filter((q) => !asked.has(q));
  const pool = unused.length >= 4 ? unused : SUGGESTED_QUESTIONS;
  // Mild rotation so consecutive turns don't look identical
  const offset = asked.size % Math.max(pool.length, 1);
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated.slice(0, 4);
}

/** kb-summaries/{child}/{date}-{kind}.md → which share category it belongs to */
function kbHitAllowed(hit: KbHit, sharing: ParentSharingFlags): boolean {
  const kind = /\d{4}-\d{2}-\d{2}-([a-z]+)\.md/.exec(hit.sourceUri ?? "")?.[1];
  switch (kind) {
    case "emotion":
      return sharing.mood === "shown";
    case "mission":
      return sharing.adventures === "shown";
    case "timeline":
    case "interests":
      return sharing.memoryHighlights === "shown";
    case "memory":
      return sharing.mood === "shown" && sharing.memoryHighlights === "shown";
    default:
      return false;
  }
}

export async function askParentReport(
  guardianUserId: string,
  question: string
): Promise<ParentReportResponse> {
  const link = await resolveChild(guardianUserId);
  if (!link.linked || !link.childUserId) {
    return {
      linked: false,
      childName: null,
      suggestedQuestions: pickFollowUpQuestions(),
      answer: null,
    };
  }

  const childId = link.childUserId;
  if (await isChildConsentPending(childId)) {
    const consent = await getGuardianConsentView(guardianUserId);
    return {
      linked: true,
      consentRequired: true,
      childName: consent.childName ?? link.childName,
      suggestedQuestions: pickFollowUpQuestions(),
      answer: null,
    };
  }

  const q = question.trim();
  if (!q) {
    return {
      linked: true,
      childName: link.childName,
      suggestedQuestions: pickFollowUpQuestions(),
      answer: null,
    };
  }

  const sharing = await resolveGuardianSharing(guardianUserId, childId);
  const moodShown = sharing.mood === "shown";
  const adventuresShown = sharing.adventures === "shown";
  const highlightsShown = sharing.memoryHighlights === "shown";
  const memoryShown = moodShown && highlightsShown;

  const [garden, memory, adventure, wishes, dayStoryPacks, childWording] =
    await Promise.all([
      moodShown ? getGardenAccount(childId) : Promise.resolve(null),
      getConversationMemory(childId),
      adventuresShown ? getAdventureQuest(childId) : Promise.resolve(null),
      highlightsShown ? getWishTreeAccount(childId) : Promise.resolve(null),
      adventuresShown && highlightsShown
        ? listDayStoriesForUser(childId)
        : Promise.resolve([]),
      recentChildWording(childId, {
        exclude: [link.childName, ...ownNames(link.persona)],
      }),
    ]);

  const themes = moodShown
    ? (memory.emotionalThemes ?? []).filter(
        (t) => !detectLeak(t, childWording).leak
      )
    : [];
  const todayMood = garden ? todayMoodFromGarden(garden.flowers) : null;
  const mood = todayMood
    ? MOOD_OPTIONS.find((m) => m.id === todayMood)?.label ?? null
    : null;
  const completed = adventure
    ? adventure.quests
        .filter((quest) => quest.status === "done")
        .map((quest) => quest.title)
    : [];
  const wishCount = wishes?.wishes.length ?? 0;

  const weeklyMoods = garden
    ? [...garden.flowers]
        .sort((a, b) => a.plantedOn.localeCompare(b.plantedOn))
        .slice(-7)
        .map((f) => MOOD_OPTIONS.find((o) => o.id === f.mood)?.label ?? "기록")
    : [];

  // KB summaries are filtered by the same category rule, then leak-checked.
  const rag =
    moodShown || adventuresShown || highlightsShown
      ? await retrieveGuardianContext({
          childUserId: childId,
          question: q,
          maxResults: 5,
        })
      : { hits: [] as KbHit[] };
  const kbHits = rag.hits.filter(
    (hit) =>
      kbHitAllowed(hit, sharing) && !detectLeak(hit.text, childWording).leak
  );

  const context = {
    childName: link.childName,
    hospitalDay: link.persona?.dayCount ?? 1,
    todayMood: mood,
    weeklyMoods,
    emotionalThemes: themes,
    // Learned summary from child↔Beddy chat — NOT raw transcripts
    conversationMemorySummary: memoryShown ? formatMemoryForPrompt(memory) : "",
    turnCount: memoryShown ? memory.turnCount : 0,
    completedAdventures: completed,
    adventureHeadline: adventure?.headline ?? null,
    wishCount,
    recentDayStoryTitles: dayStoryPacks
      .slice(0, 3)
      .map((p) => p.dayStory?.narrative?.slice(0, 48))
      .filter((v): v is string => Boolean(v)),
    kbSummaries: formatKbHitsForPrompt(kbHits),
  };

  const sources: string[] = [];
  if (mood) sources.push("오늘의 감정");
  if (themes.length) sources.push("마음 키워드");
  if (context.turnCount > 0) sources.push("학습된 대화 메모리");
  if (completed.length) sources.push("완료한 모험");
  if (wishCount) sources.push("소원 나무");
  if (weeklyMoods.length) sources.push("주간 감정 흐름");
  if (context.recentDayStoryTitles.length) sources.push("하루 이야기");
  for (const label of kbSourceLabels(kbHits)) {
    if (!sources.includes(label)) sources.push(label);
  }

  const llmAnswer = await composeReportAnswerWithLlm(q, context);
  const fallback = composeReportAnswer({
    question: q,
    childName: link.childName,
    mood,
    themes,
    completed,
    wishCount,
    weeklyMoods,
  });

  const answer: ParentReportAnswer = llmAnswer
    ? {
        question: q,
        answer: guardGuardianText(llmAnswer, childWording, fallback.answer).text,
        sources: sources.length ? sources : ["요약 인사이트"],
      }
    : {
        ...fallback,
        answer: guardGuardianText(
          fallback.answer,
          childWording,
          "요약된 기록만으로는 아직 답하기 어려워요. 조금 더 기록이 쌓이면 다시 물어봐 주세요."
        ).text,
      };

  return {
    linked: true,
    childName: link.childName,
    suggestedQuestions: pickFollowUpQuestions([q]),
    answer,
  };
}

async function composeReportAnswerWithLlm(
  question: string,
  context: {
    childName: string;
    hospitalDay: number;
    todayMood: string | null;
    weeklyMoods: string[];
    emotionalThemes: string[];
    conversationMemorySummary: string;
    turnCount: number;
    completedAdventures: string[];
    adventureHeadline: string | null;
    wishCount: number;
    recentDayStoryTitles: string[];
    kbSummaries: string;
  }
): Promise<string | null> {
  try {
    const result = await runLlm({
      feature: "rag.guardian.generate",
      purpose: "quality",
      childName: context.childName,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 병원 아이 돌봄 앱 Beddy의 보호자용 AI 어시스턴트입니다.

역할:
- 연결된 아이의 요약 데이터와 지식 검색(KB) 요약만 보고, 보호자 질문에 따뜻하고 구체적으로 답합니다.
- 아이와 베디의 원문 대화·비밀 일기는 절대 인용하거나 재구성하지 않습니다.
- 주어진 요약(감정, 모험, 학습 메모리 요약, 소원, 하루 이야기 제목, KB 요약)만 근거로 씁니다.
- 좌표·지역명·정확한 위치는 언급하지 마세요.
- 데이터가 부족하면 솔직히 말하고, 같은 문장을 반복하지 마세요.
- 2~5문장, 한국어, 존댓말. 과장하거나 확정적으로 단정하지 마세요.`),
        },
        {
          role: "user",
          content: `보호자 질문: ${question}

아이 요약 컨텍스트(JSON):
${JSON.stringify({ ...context, kbSummaries: undefined }, null, 2)}

KB 검색 요약(프라이버시 필터 통과):
${context.kbSummaries}

위 요약만으로 답변하세요. 원문 대화는 없습니다.`,
        },
      ],
      temperature: 0.55,
      maxTokens: 420,
    });

    const text = result.content?.trim();
    if (!text || text.length < 8) return null;

    // Mock provider often echoes generic lines — still allow but strip fences
    return text
      .replace(/^```[\s\S]*?```$/g, (block) =>
        block.replace(/^```(?:json|text)?\n?/i, "").replace(/\n?```$/, "")
      )
      .trim()
      .slice(0, 900);
  } catch (error) {
    console.warn("[parent-report] LLM answer skipped", error);
    return null;
  }
}

function composeReportAnswer(input: {
  question: string;
  childName: string;
  mood: string | null;
  themes: string[];
  completed: string[];
  wishCount: number;
  weeklyMoods: string[];
}): ParentReportAnswer {
  const sources: string[] = [];
  if (input.mood) sources.push("오늘의 감정");
  if (input.themes.length) sources.push("마음 키워드");
  if (input.completed.length) sources.push("완료한 모험");
  if (input.wishCount) sources.push("소원 나무");
  if (input.weeklyMoods.length) sources.push("주간 감정 흐름");

  let answer: string;
  if (/행복|기쁜|즐거/.test(input.question)) {
    answer = input.completed[0]
      ? `${input.childName}에게는 “${input.completed[0]}” 같은 작은 성취가 특히 반짝였어요. ${
          input.mood ? `오늘의 기운도 ${input.mood} 쪽에 가깝고요.` : ""
        } 대화 원문은 보여 드리지 않고, 요약된 순간만 전해요.`
      : `${input.childName}의 행복한 순간은 아직 모이는 중이에요. ${
          input.themes[0]
            ? `요즘 이야기 키워드로는 “${input.themes[0]}”가 보이네요.`
            : "조금만 더 기록이 쌓이면 더 또렷해질 거예요."
        }`;
  } else if (/활동|좋아|모험|취미/.test(input.question)) {
    answer = input.completed.length
      ? `${input.childName}가 최근에 잘 해낸 활동은 ${input.completed
          .slice(0, 3)
          .map((t) => `“${t}”`)
          .join(", ")} 쪽이에요.`
      : `아직 완료된 모험이 많지 않아요. 그래도 ${input.childName}의 관심은 천천히 쌓이고 있어요.`;
  } else if (/기분|감정|흐름|변화/.test(input.question)) {
    const flow =
      input.weeklyMoods.length > 0
        ? input.weeklyMoods.slice(-5).join(" → ")
        : "아직 짧은 기록";
    answer = `최근 기분 흐름은 ${flow} 정도예요. ${
      input.mood ? `오늘은 ${input.mood}에 가깝고요.` : ""
    } 의료적 판단이 아니라, 곁을 위한 감정 스케치로만 봐 주세요.`;
  } else if (/기억|추억/.test(input.question)) {
    answer = input.themes[0]
      ? `${input.childName}와 베디의 이야기에서 자주 남는 키워드는 “${input.themes
          .slice(0, 3)
          .join(" · ")}”예요. 자세한 대화 내용은 비밀로 두고, 키워드만 전해요.`
      : `아직 뚜렷한 기억 키워드가 많지 않아요.`;
  } else {
    answer = `${input.childName}의 오늘은 ${
      input.mood ?? "조용한 기다림"
    }으로 읽혀요. ${
      input.completed[0] ? `작은 모험 “${input.completed[0]}”도 있었고요. ` : ""
    }원문 대화는 보여 드리지 않아요 — 이해와 응원을 위한 요약만 드릴게요.`;
  }

  return {
    question: input.question,
    answer: answer.trim(),
    sources: sources.length ? sources : ["요약 인사이트"],
  };
}

export async function getParentProfile(
  guardianUserId: string,
  guardian: { name: string; email: string }
): Promise<ParentProfileResponse> {
  const link = await resolveChild(guardianUserId);
  const [settings, consent] = await Promise.all([
    getParentSettings(guardianUserId),
    getGuardianConsentView(guardianUserId),
  ]);
  const consentPending = consent.linked && consent.status === "pending";
  const childSharing =
    link.linked && link.childUserId && !consentPending
      ? await getChildShareChoices(link.childUserId)
      : null;
  return {
    guardianName: guardian.name,
    guardianEmail: guardian.email,
    linked: link.linked,
    childName: consentPending ? consent.childName : link.childName,
    hospitalDay: link.linked ? link.persona?.dayCount ?? 1 : null,
    notifications: settings.notifications,
    privacy: {
      ...settings.privacy,
      hidePrivateChat: true,
    },
    consent,
    childSharing,
  };
}

export async function updateParentProfileSettings(
  guardianUserId: string,
  patch: {
    notifications?: Partial<ParentProfileResponse["notifications"]>;
    privacy?: Partial<{
      shareEmotionTrends: boolean;
      shareAdventures: boolean;
      shareMemoryHighlights: boolean;
    }>;
  }
): Promise<ParentProfileResponse["notifications"] & { privacy: ParentProfileResponse["privacy"] }> {
  const current = await getParentSettings(guardianUserId);

  const notifications = { ...current.notifications };
  if (typeof patch.notifications?.dailyDigest === "boolean") {
    notifications.dailyDigest = patch.notifications.dailyDigest;
  }
  if (typeof patch.notifications?.careTips === "boolean") {
    notifications.careTips = patch.notifications.careTips;
  }

  const privacy = { ...current.privacy };
  if (typeof patch.privacy?.shareEmotionTrends === "boolean") {
    privacy.shareEmotionTrends = patch.privacy.shareEmotionTrends;
  }
  if (typeof patch.privacy?.shareAdventures === "boolean") {
    privacy.shareAdventures = patch.privacy.shareAdventures;
  }
  if (typeof patch.privacy?.shareMemoryHighlights === "boolean") {
    privacy.shareMemoryHighlights = patch.privacy.shareMemoryHighlights;
  }

  const next = await saveParentSettings({
    ...current,
    guardianUserId,
    notifications,
    privacy,
  });
  return {
    ...next.notifications,
    privacy: { ...next.privacy, hidePrivateChat: true as const },
  };
}
