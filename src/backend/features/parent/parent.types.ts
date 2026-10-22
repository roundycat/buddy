/**
 * Parent (guardian) experience DTOs — privacy-safe summaries only.
 * Never includes raw chat logs or private diary text.
 */
import type { GuardianConsentView } from "@/backend/features/consent/consent.types";
import type {
  GuardianVisibility,
  GuardianVisibilityMap,
  ShareChoices,
} from "@/backend/features/sharing/sharing.types";

export type ParentMoodTone = "warm" | "calm" | "tired" | "brave" | "mixed";

/** shown | child_private (아이가 아직 나누지 않았어요 🔒) | guardian_off */
export type ParentShareVisibility = GuardianVisibility;

/** Per-category visibility: the child shares it AND the guardian's toggle is on. */
export type ParentSharingFlags = GuardianVisibilityMap;

/** Linked child is under 14 and still waits for legal-guardian consent. */
export interface ParentConsentGate {
  childName: string;
  consentVersion: string;
}

/** A concern the child agreed to share — summary only. */
export interface ParentConcernNotice {
  id: string;
  summary: string;
  sharedAt: string;
}

export interface ParentChildSummary {
  childName: string;
  hospitalDay: number;
  moodLabel: string;
  moodEmoji: string;
  statusLine: string;
}

export interface ParentTodayMessage {
  text: string;
  generatedAtLabel: string;
}

export interface ParentEmotionPoint {
  dayLabel: string;
  dateKey?: string;
  tone: ParentMoodTone;
  label: string;
  /** 0–100 mood energy for charting */
  score: number;
  emoji?: string;
  empty?: boolean;
}

export interface ParentEmotionOverview {
  dominantLabel: string;
  dominantEmoji: string;
  weekly: ParentEmotionPoint[];
  /** Soft counts for chip display */
  distribution: Array<{ label: string; emoji: string; percent: number }>;
}

export interface ParentAdventureItem {
  id: string;
  title: string;
  emoji: string;
  completed: boolean;
}

export interface ParentMemoryHighlight {
  id: string;
  kind: "photo" | "drawing" | "mission" | "reflection" | "badge";
  title: string;
  caption: string;
  emoji: string;
  /** Guardian-proxied image URL when this highlight is a real media item */
  imageUrl?: string;
}

/** Child album photos + diary drawings visible to a linked guardian. */
export interface ParentMediaItem {
  id: string;
  kind: "photo" | "drawing" | "diary_photo";
  title: string;
  caption: string;
  imageUrl: string;
  createdAt: string;
  dateKey?: string;
}

export interface ParentCareSuggestion {
  id: string;
  text: string;
}

/** Daily non-clinical empathy coaching for parents */
export interface ParentEmpathyGuide {
  dateKey: string;
  emotionalSummary: string;
  empathyCoaching: {
    avoidSaying: string;
    trySaying: string;
    why: string;
  };
  thingsToDo: string[];
  thingsToAvoid: string[];
  encouragingMessage: string;
  /** Soft sources used (privacy-safe labels only) */
  sources: string[];
  generatedAt: string;
}

/** Summary-only safety notice — never includes raw child chat */
export interface ParentSafetyAlert {
  id: string;
  level: "elevated" | "urgent";
  summary: string;
  createdAt: string;
}

export interface ParentHomeDashboard {
  linked: boolean;
  companionNote: string;
  child: ParentChildSummary | null;
  todayMessage: ParentTodayMessage | null;
  emotion: ParentEmotionOverview | null;
  adventures: ParentAdventureItem[];
  memories: ParentMemoryHighlight[];
  /** Recent photos & drawings from the linked child (privacy-gated). */
  media: ParentMediaItem[];
  dailySummary: string | null;
  careSuggestions: ParentCareSuggestion[];
  /** Today's Empathy Guide — communication support, never diagnostic */
  empathyGuide: ParentEmpathyGuide | null;
  /** Active crisis safety alert (summary only) */
  safetyAlert: ParentSafetyAlert | null;
  /** Set when consent must be given before anything else is shown */
  consentGate: ParentConsentGate | null;
  /** Explicit per-category flags; null when not linked / consent pending */
  sharing: ParentSharingFlags | null;
  /** Concerns the child said "알려도 돼" to */
  concernNotices: ParentConcernNotice[];
  updatedLabel: string;
}

export interface ParentTimelineScheduleItem {
  id: string;
  type: "exam" | "treatment";
  title: string;
  time?: string;
  done?: boolean;
}

export interface ParentTimelineEntry {
  id: string;
  dateKey: string;
  dayLabel: string;
  hospitalDay: number;
  moodEmoji: string;
  moodLabel: string;
  headline: string;
  reflection: string;
  adventures: string[];
  memories: string[];
  badges: string[];
  schedules: ParentTimelineScheduleItem[];
}

export type ParentCalendarMark = "exam" | "treatment" | "adventure" | "mood";

export interface ParentCalendarDay {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  marks: ParentCalendarMark[];
  /** Primary emoji for the cell */
  icon: string;
  hasContent: boolean;
}

export interface ParentTimelineResponse {
  linked: boolean;
  childName: string | null;
  monthKey: string;
  monthLabel: string;
  calendarDays: ParentCalendarDay[];
  entries: ParentTimelineEntry[];
  /** Linked child still waits for legal-guardian consent */
  consentRequired?: boolean;
  sharing?: ParentSharingFlags | null;
}

export interface ParentReportAnswer {
  question: string;
  answer: string;
  sources: string[];
}

export interface ParentReportResponse {
  linked: boolean;
  childName: string | null;
  suggestedQuestions: string[];
  answer: ParentReportAnswer | null;
  /** Linked child still waits for legal-guardian consent */
  consentRequired?: boolean;
}

export interface ParentProfileResponse {
  guardianName: string;
  guardianEmail: string;
  linked: boolean;
  childName: string | null;
  hospitalDay: number | null;
  notifications: {
    dailyDigest: boolean;
    careTips: boolean;
  };
  privacy: {
    shareEmotionTrends: boolean;
    shareAdventures: boolean;
    shareMemoryHighlights: boolean;
    hidePrivateChat: true;
  };
  /** Legal-guardian consent status for the linked child */
  consent: GuardianConsentView;
  /** What the child chose to share (null when not linked / consent pending) */
  childSharing: ShareChoices | null;
}
