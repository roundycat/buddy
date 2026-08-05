/**
 * Common hospital schedule presets for long-stay parents.
 * Adult labels — no emoji chrome.
 */

export type ScheduleTemplateId =
  | "blood"
  | "medication"
  | "round"
  | "xray"
  | "mri"
  | "rehab"
  | "injection"
  | "custom";

export type ScheduleTemplateIcon =
  | "droplet"
  | "pill"
  | "stethoscope"
  | "scan"
  | "magnet"
  | "activity"
  | "syringe"
  | "plus";

export interface ScheduleTemplate {
  id: ScheduleTemplateId;
  label: string;
  icon: ScheduleTemplateIcon;
  type: "exam" | "treatment";
  title: string;
  colorTag: string;
  noteHint?: string;
}

export const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    id: "blood",
    label: "피검사",
    icon: "droplet",
    type: "exam",
    title: "피검사",
    colorTag: "#64748B",
    noteHint: "팔에 살짝 바늘만 대요",
  },
  {
    id: "medication",
    label: "투약",
    icon: "pill",
    type: "treatment",
    title: "약 복용",
    colorTag: "#475569",
    noteHint: "물과 함께 천천히",
  },
  {
    id: "round",
    label: "회진",
    icon: "stethoscope",
    type: "exam",
    title: "회진",
    colorTag: "#334155",
  },
  {
    id: "xray",
    label: "X-ray",
    icon: "scan",
    type: "exam",
    title: "엑스레이",
    colorTag: "#64748B",
  },
  {
    id: "mri",
    label: "MRI",
    icon: "magnet",
    type: "exam",
    title: "MRI 검사",
    colorTag: "#475569",
  },
  {
    id: "rehab",
    label: "재활",
    icon: "activity",
    type: "treatment",
    title: "재활 치료",
    colorTag: "#334155",
  },
  {
    id: "injection",
    label: "주사",
    icon: "syringe",
    type: "treatment",
    title: "주사",
    colorTag: "#64748B",
    noteHint: "살짝 따끔할 수 있어요",
  },
  {
    id: "custom",
    label: "직접 입력",
    icon: "plus",
    type: "exam",
    title: "",
    colorTag: "#94A3B8",
  },
];

export function getScheduleTemplate(
  id: string | undefined
): ScheduleTemplate | undefined {
  if (!id) return undefined;
  return SCHEDULE_TEMPLATES.find((t) => t.id === id);
}

export const QUICK_TIMES = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "14:00",
  "16:00",
  "18:00",
] as const;

export type RepeatOptionId =
  | "once"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "custom";

export const REPEAT_OPTIONS: Array<{
  id: RepeatOptionId;
  label: string;
  hint: string;
}> = [
  { id: "once", label: "한 번", hint: "선택한 날짜만" },
  { id: "daily", label: "매일", hint: "7일간" },
  { id: "weekdays", label: "평일", hint: "월–금" },
  { id: "weekly", label: "매주", hint: "4주" },
  { id: "monthly", label: "매월", hint: "3개월" },
  { id: "custom", label: "요일", hint: "원하는 요일" },
];

export const REMINDER_OPTIONS: Array<{
  minutes: number | null;
  label: string;
}> = [
  { minutes: null, label: "끄기" },
  { minutes: 5, label: "5분 전" },
  { minutes: 10, label: "10분 전" },
  { minutes: 30, label: "30분 전" },
  { minutes: 60, label: "1시간 전" },
];

export function repeatLabelFor(
  rule: RepeatOptionId,
  weekdays?: number[]
): string {
  switch (rule) {
    case "once":
      return "한 번";
    case "daily":
      return "매일";
    case "weekdays":
      return "평일";
    case "weekly":
      return "매주";
    case "monthly":
      return "매월";
    case "custom": {
      const names = ["일", "월", "화", "수", "목", "금", "토"];
      if (!weekdays?.length) return "요일 선택";
      return weekdays.map((d) => names[d] ?? "").join("·");
    }
    default:
      return "";
  }
}
