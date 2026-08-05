/**
 * Parent (guardian) experience DTOs — privacy-safe summaries only.
 * Never includes raw chat logs or private diary text.
 */

export type ParentMoodTone = "warm" | "calm" | "tired" | "brave" | "mixed";

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

export interface ParentHomeDashboard {
  linked: boolean;
  companionNote: string;
  child: ParentChildSummary | null;
  todayMessage: ParentTodayMessage | null;
  emotion: ParentEmotionOverview | null;
  adventures: ParentAdventureItem[];
  memories: ParentMemoryHighlight[];
  dailySummary: string | null;
  careSuggestions: ParentCareSuggestion[];
  /** Today's Empathy Guide — communication support, never diagnostic */
  empathyGuide: ParentEmpathyGuide | null;
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
}
