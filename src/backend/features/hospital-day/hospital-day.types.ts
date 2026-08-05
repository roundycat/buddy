/**
 * Today's hospital life — gentle, non-clinical schedule storytelling.
 * Parent-created exam/treatment items sync to the linked child.
 */

export type HospitalItemType =
  | "exam"
  | "treatment"
  | "play"
  | "quiz"
  | "story"
  | "cheer";

export type HospitalItemSource = "parent" | "system";

/** How a parent schedule repeats when created */
export type ScheduleRepeatRule =
  | "once"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "custom";

export type ScheduleReminderMinutes = 5 | 10 | 30 | 60 | number;

export interface HospitalDayItem {
  id: string;
  type: HospitalItemType;
  title: string;
  /** Child-facing gentle title (optional override) */
  childTitle?: string;
  time?: string;
  explanation: string;
  /** LLM: 이게 뭐예요? */
  whatText?: string;
  /** LLM: 왜 할까요? */
  whyText?: string;
  /** LLM: short notify toast line */
  notifyText?: string;
  /** Soft illustration for child notify sheet */
  imageUrl?: string;
  imageStatus?: "pending" | "ready" | "failed";
  /** Prompt schema version used to generate imageUrl */
  imagePromptVersion?: number;
  done?: boolean;
  /** Parent marked skip for this occurrence (not completed) */
  skipped?: boolean;
  source?: HospitalItemSource;
  createdByGuardianId?: string;
  dateKey: string;
  childUserId: string;
  /** Set when the child first sees this schedule (delivery effect) */
  seenByChildAt?: string;
  /** Preset library id (blood, meds, …) */
  templateId?: string;
  /** Soft color tag for parent cards */
  colorTag?: string;
  /** Repeat rule used at creation (display) */
  repeatRule?: ScheduleRepeatRule;
  /** Human-readable repeat, e.g. "매일", "매주 월요일" */
  repeatLabel?: string;
  /** Series id linking expanded occurrences */
  seriesId?: string;
  /** Minutes before time to remind parent */
  reminderMinutes?: ScheduleReminderMinutes | null;
  reminderEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HospitalDayFreshDelivery {
  id: string;
  type: HospitalItemType;
  title: string;
  childTitle?: string;
  time?: string;
  notifyText?: string;
  whatText?: string;
  /** Soft illustration for child notify sheet */
  imageUrl?: string;
  imageStatus?: "pending" | "ready" | "failed";
}

export interface HospitalDayResponse {
  dateLabel: string;
  companionNote: string;
  items: HospitalDayItem[];
  parentItemCount: number;
  /** Parent schedules first seen on this load — for child delivery FX */
  freshDeliveries: HospitalDayFreshDelivery[];
  /** Selected calendar date YYYY-MM-DD */
  dateKey?: string;
}

export interface HospitalCalendarDay {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  hasContent: boolean;
  examCount: number;
  treatmentCount: number;
  icon: string;
}

export interface HospitalScheduleMonthResponse {
  monthKey: string;
  monthLabel: string;
  calendarDays: HospitalCalendarDay[];
  /** Dates in this month that have parent schedules (sorted) */
  datesWithSchedules: string[];
}

export interface CreateHospitalScheduleInput {
  type: "exam" | "treatment";
  title: string;
  time?: string;
  note?: string;
  dateKey?: string;
  templateId?: string;
  colorTag?: string;
  repeatRule?: ScheduleRepeatRule;
  /** For weekly/custom: 0=Sun … 6=Sat */
  repeatWeekdays?: number[];
  /** Cap how many occurrences to materialize (default by rule) */
  repeatCount?: number;
  reminderMinutes?: ScheduleReminderMinutes | null;
  reminderEnabled?: boolean;
}

export interface UpdateHospitalScheduleInput {
  title?: string;
  time?: string | null;
  note?: string;
  done?: boolean;
  skipped?: boolean;
  type?: "exam" | "treatment";
  colorTag?: string;
  reminderMinutes?: ScheduleReminderMinutes | null;
  reminderEnabled?: boolean;
  dateKey?: string;
}
