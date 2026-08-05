import { todayKey } from "@/backend/shared/time/date";
import { resolveLinkedChildUserId } from "@/backend/features/guardian-link/guardian-link.service";
import {
  deleteScheduleItem,
  getScheduleItem,
  listScheduleForChild,
  saveScheduleItem,
} from "./hospital-day.store";
import type {
  CreateHospitalScheduleInput,
  HospitalCalendarDay,
  HospitalDayFreshDelivery,
  HospitalDayItem,
  HospitalDayResponse,
  HospitalScheduleMonthResponse,
  ScheduleRepeatRule,
  UpdateHospitalScheduleInput,
} from "./hospital-day.types";
import {
  composeChildScheduleCopy,
  shouldEnrichScheduleWithLlm,
} from "./schedule-copy.llm";
import { kickoffScheduleImage } from "./schedule-image.generate";

function softExplanation(type: "exam" | "treatment", title: string, note?: string) {
  if (note?.trim()) return note.trim();
  if (type === "exam") {
    return `오늘은 “${title}”을(를) 살펴보는 시간이에요. 아프게 하려는 게 아니라, 지금 몸을 알아보기 위함이에요. 긴장되면 베디에게 말해도 괜찮아요.`;
  }
  return `오늘은 “${title}”을(를) 도와주는 시간이에요. 중간에 힘들면 말해도 괜찮아요. 보호자 분도 함께 알고 있어요.`;
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function addDays(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

function weekdayOf(dateKey: string): number {
  return parseDateKey(dateKey).getDay(); // 0 Sun
}

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function buildRepeatLabel(
  rule: ScheduleRepeatRule,
  weekdays?: number[]
): string {
  switch (rule) {
    case "once":
      return "한 번";
    case "daily":
      return "매일";
    case "weekdays":
      return "평일마다";
    case "weekly":
      return "매주";
    case "monthly":
      return "매월";
    case "custom": {
      if (!weekdays?.length) return "요일 선택";
      return `${weekdays.map((w) => WEEKDAY_NAMES[w]).join("·")}요일`;
    }
    default:
      return "한 번";
  }
}

/** Expand a start date into occurrence dateKeys for the repeat rule. */
export function expandScheduleDateKeys(
  startKey: string,
  rule: ScheduleRepeatRule,
  weekdays?: number[],
  countCap?: number
): string[] {
  if (rule === "once") return [startKey];

  const keys: string[] = [];
  const max =
    countCap ??
    (rule === "daily"
      ? 7
      : rule === "weekdays"
        ? 10
        : rule === "weekly"
          ? 4
          : rule === "monthly"
            ? 3
            : 8);

  if (rule === "daily") {
    for (let i = 0; i < max; i++) keys.push(addDays(startKey, i));
    return keys;
  }

  if (rule === "weekdays") {
    let offset = 0;
    while (keys.length < max && offset < 40) {
      const key = addDays(startKey, offset);
      const wd = weekdayOf(key);
      if (wd >= 1 && wd <= 5) keys.push(key);
      offset += 1;
    }
    return keys;
  }

  if (rule === "weekly") {
    for (let i = 0; i < max; i++) keys.push(addDays(startKey, i * 7));
    return keys;
  }

  if (rule === "monthly") {
    const start = parseDateKey(startKey);
    for (let i = 0; i < max; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      keys.push(todayKey(d));
    }
    return keys;
  }

  // custom: selected weekdays from start for ~4 weeks
  const wanted = new Set(
    (weekdays?.length ? weekdays : [weekdayOf(startKey)]).filter(
      (w) => w >= 0 && w <= 6
    )
  );
  let offset = 0;
  while (keys.length < max && offset < 40) {
    const key = addDays(startKey, offset);
    if (wanted.has(weekdayOf(key))) keys.push(key);
    offset += 1;
  }
  return keys.length ? keys : [startKey];
}

function softChildTitle(type: "exam" | "treatment", title: string) {
  if (type === "exam") return `검사 시간 · ${title}`;
  return `치료 시간 · ${title}`;
}

function systemCheerItems(childUserId: string, dateKey: string): HospitalDayItem[] {
  const now = new Date().toISOString();
  return [
    {
      id: `sys-cheer-${dateKey}`,
      type: "cheer",
      title: "오늘의 응원",
      explanation:
        "오늘도 여기까지 온 것만으로 충분해요. 당신은 혼자가 아니에요.",
      source: "system",
      dateKey,
      childUserId,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/**
 * Child-facing hospital day. Merges parent schedules + gentle system cheer.
 * First view marks parent items as seen and returns freshDeliveries for FX.
 */
export async function getHospitalDay(
  userId?: string,
  dateKey = todayKey()
): Promise<HospitalDayResponse> {
  if (!userId) {
    return {
      dateLabel: "오늘",
      companionNote:
        "로그인하면 보호자가 알려 준 오늘의 일정도 함께 볼 수 있어요.",
      items: systemCheerItems("anonymous", dateKey).map(({ ...rest }) => rest),
      parentItemCount: 0,
      freshDeliveries: [],
    };
  }

  let parentItems = await autoCompleteDueScheduleItems(userId, dateKey);
  const nowIso = new Date().toISOString();
  const freshDeliveries: HospitalDayFreshDelivery[] = [];

  parentItems = await Promise.all(
    parentItems.map(async (item) => {
      if (item.source !== "parent" || item.seenByChildAt) return item;
      const next = await saveScheduleItem({
        ...item,
        seenByChildAt: nowIso,
        updatedAt: nowIso,
      });
      freshDeliveries.push({
        id: next.id,
        type: next.type,
        title: next.title,
        childTitle: next.childTitle,
        time: next.time,
        notifyText: next.notifyText,
        whatText: next.whatText,
      });
      return next;
    })
  );

  const cheer = systemCheerItems(userId, dateKey);
  const items = [...parentItems, ...cheer].sort((a, b) => {
    const ta = a.time || "99:99";
    const tb = b.time || "99:99";
    return ta.localeCompare(tb);
  });

  const pending = parentItems.filter((i) => !i.done);
  const nextUp = pending.find((i) => i.time) ?? pending[0];
  const isToday = dateKey === todayKey();
  const companionNote =
    pending.length > 0
      ? nextUp?.time
        ? `보호자가 ${nextUp.time}에 “${nextUp.childTitle || nextUp.title}”을(를) 알려 줬어요. 천천히 같이 준비해 볼까요?`
        : `보호자가 알려 준 일정이 ${pending.length}개 있어요. 천천히, 하나씩 같이 살펴봐요.`
      : isToday
        ? "오늘은 특별한 병원 일정이 아직 없어요. 쉬는 것도 괜찮은 하루예요."
        : "이 날에는 아직 알려 준 일정이 없어요. 쉬는 날도 괜찮아요.";

  return {
    dateLabel:
      dateKey === todayKey()
        ? "오늘"
        : formatDayLabel(dateKey),
    companionNote,
    items,
    parentItemCount: parentItems.length,
    freshDeliveries,
    dateKey,
  };
}

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${m}월 ${d}일`;
}

function parseMonthKey(monthKey: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function buildHospitalCalendarDays(
  year: number,
  month: number,
  counts: Map<string, { exam: number; treatment: number }>
): HospitalCalendarDay[] {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = todayKey();
  const cells: HospitalCalendarDay[] = [];

  const pushDay = (date: Date, inMonth: boolean) => {
    const dateKey = todayKey(date);
    const c = counts.get(dateKey);
    const examCount = c?.exam ?? 0;
    const treatmentCount = c?.treatment ?? 0;
    const hasContent = inMonth && examCount + treatmentCount > 0;
    let icon = "·";
    if (!inMonth) icon = "";
    else if (treatmentCount > 0) icon = "💉";
    else if (examCount > 0) icon = "🩺";

    cells.push({
      dateKey,
      day: date.getDate(),
      inMonth,
      isToday: dateKey === today,
      hasContent,
      examCount,
      treatmentCount,
      icon,
    });
  };

  for (let i = startPad - 1; i >= 0; i--) {
    pushDay(new Date(year, month - 1, -i), false);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    pushDay(new Date(year, month - 1, day), true);
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!;
    const [y, m, d] = last.dateKey.split("-").map(Number);
    pushDay(new Date(y!, m! - 1, d! + 1), false);
  }
  return cells;
}

/**
 * Child month calendar of parent-shared exam/treatment schedules.
 */
export async function getHospitalScheduleMonth(
  userId?: string,
  monthKey = todayKey().slice(0, 7)
): Promise<HospitalScheduleMonthResponse> {
  const parsed = parseMonthKey(monthKey) ?? parseMonthKey(todayKey().slice(0, 7))!;
  const { year, month } = parsed;
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const monthLabel = `${year}년 ${month}월`;

  if (!userId) {
    return {
      monthKey: key,
      monthLabel,
      calendarDays: buildHospitalCalendarDays(year, month, new Map()),
      datesWithSchedules: [],
    };
  }

  await autoCompleteDueScheduleItems(userId);
  const all = await listScheduleForChild(userId);
  const counts = new Map<string, { exam: number; treatment: number }>();
  const datesWithSchedules: string[] = [];

  for (const item of all) {
    if (item.source !== "parent") continue;
    if (!item.dateKey.startsWith(key)) continue;
    const cur = counts.get(item.dateKey) ?? { exam: 0, treatment: 0 };
    if (item.type === "treatment") cur.treatment += 1;
    else if (item.type === "exam") cur.exam += 1;
    counts.set(item.dateKey, cur);
  }

  for (const dateKey of Array.from(counts.keys()).sort()) {
    datesWithSchedules.push(dateKey);
  }

  return {
    monthKey: key,
    monthLabel,
    calendarDays: buildHospitalCalendarDays(year, month, counts),
    datesWithSchedules,
  };
}

function parseTimeToMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

/** Past calendar day, or today after the scheduled HH:MM. */
export function isScheduleDue(
  item: Pick<HospitalDayItem, "dateKey" | "time" | "done">,
  now = new Date()
): boolean {
  if (item.done) return false;
  const today = todayKey(now);
  if (item.dateKey < today) return true;
  if (item.dateKey > today) return false;
  if (!item.time) {
    // No clock time: auto-complete after 23:59 local (end of day)
    return now.getHours() >= 23 && now.getMinutes() >= 59;
  }
  const due = parseTimeToMinutes(item.time);
  if (due == null) return false;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= due;
}

/**
 * Persist done=true for parent schedules whose time (or day) has passed.
 * When dateKey is set, still scans all child items so past days catch up,
 * then returns only that day's list.
 */
export async function autoCompleteDueScheduleItems(
  childUserId: string,
  dateKey?: string
): Promise<HospitalDayItem[]> {
  const items = await listScheduleForChild(childUserId);
  const now = new Date();

  for (const item of items) {
    if (item.source === "parent" && !item.done && isScheduleDue(item, now)) {
      await saveScheduleItem({
        ...item,
        done: true,
        updatedAt: now.toISOString(),
      });
    }
  }

  return listScheduleForChild(childUserId, dateKey);
}

export async function listParentSchedule(
  guardianUserId: string,
  dateKey = todayKey()
): Promise<{
  linked: boolean;
  childUserId: string | null;
  dateKey: string;
  items: HospitalDayItem[];
}> {
  const childUserId = await resolveLinkedChildUserId(guardianUserId);
  if (!childUserId) {
    return { linked: false, childUserId: null, dateKey, items: [] };
  }
  const items = await autoCompleteDueScheduleItems(childUserId, dateKey);
  return { linked: true, childUserId, dateKey, items };
}

/**
 * Parent creates an exam/treatment → stored on child account.
 * Repeat rules materialize multiple dateKey occurrences in one call.
 */
export async function createParentScheduleItem(
  guardianUserId: string,
  input: CreateHospitalScheduleInput
): Promise<HospitalDayItem> {
  const created = await createParentScheduleItems(guardianUserId, input);
  return created[0]!;
}

export async function createParentScheduleItems(
  guardianUserId: string,
  input: CreateHospitalScheduleInput
): Promise<HospitalDayItem[]> {
  const childUserId = await resolveLinkedChildUserId(guardianUserId);
  if (!childUserId) {
    throw new Error("먼저 아이와 연결해 주세요.");
  }

  const title = input.title.trim();
  if (!title) throw new Error("일정 이름을 입력해 주세요.");
  if (title.length > 40) throw new Error("일정 이름은 40자 이내로 입력해 주세요.");

  const type = input.type === "treatment" ? "treatment" : "exam";
  const dateKey = input.dateKey?.trim() || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("날짜 형식이 올바르지 않아요. 예: 2026-08-04");
  }

  let time: string | undefined;
  if (input.time?.trim()) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(input.time.trim());
    if (!m) {
      throw new Error("시간은 HH:MM 형식으로 입력해 주세요. 예: 14:30");
    }
    time = `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
  }

  const repeatRule: ScheduleRepeatRule = input.repeatRule ?? "once";
  const dateKeys = expandScheduleDateKeys(
    dateKey,
    repeatRule,
    input.repeatWeekdays,
    input.repeatCount
  );
  const repeatLabel = buildRepeatLabel(repeatRule, input.repeatWeekdays);
  const seriesId =
    dateKeys.length > 1 ? `series-${crypto.randomUUID()}` : undefined;

  const now = new Date().toISOString();
  const fallbackWhat =
    type === "exam"
      ? `“${title}”을(를) 살펴보는 시간이에요.`
      : `“${title}”을(를) 도와주는 시간이에요.`;
  const fallbackWhy = softExplanation(type, title, input.note);

  let whatText = fallbackWhat;
  let whyText = fallbackWhy;
  let notifyText =
    type === "exam"
      ? `보호자가 ${title} 검사를 알려 줬어요`
      : `보호자가 ${title} 치료를 알려 줬어요`;

  if (shouldEnrichScheduleWithLlm(title, input.note)) {
    const llmCopy = await composeChildScheduleCopy({
      type,
      title,
      note: input.note,
    });
    if (llmCopy) {
      whatText = llmCopy.what;
      whyText = llmCopy.why;
      notifyText = llmCopy.notify;
    }
  }

  const reminderEnabled =
    typeof input.reminderEnabled === "boolean"
      ? input.reminderEnabled
      : input.reminderMinutes != null && input.reminderMinutes > 0;

  const saved: HospitalDayItem[] = [];
  for (const key of dateKeys) {
    const item: HospitalDayItem = {
      id: `hs-${crypto.randomUUID()}`,
      type,
      title,
      childTitle: softChildTitle(type, title),
      time,
      explanation: whyText,
      whatText,
      whyText,
      notifyText,
      imageStatus: "pending",
      done: false,
      skipped: false,
      source: "parent",
      createdByGuardianId: guardianUserId,
      dateKey: key,
      childUserId,
      templateId: input.templateId,
      colorTag: input.colorTag,
      repeatRule,
      repeatLabel,
      seriesId,
      reminderMinutes: input.reminderMinutes ?? null,
      reminderEnabled,
      createdAt: now,
      updatedAt: now,
    };
    const row = await saveScheduleItem(item);
    kickoffScheduleImage(row.id);
    saved.push(row);
  }

  return saved;
}

export async function duplicateParentScheduleItem(
  guardianUserId: string,
  itemId: string,
  opts?: { dateKey?: string; titleSuffix?: string }
): Promise<HospitalDayItem> {
  const existing = await getScheduleItem(itemId);
  if (!existing || existing.source !== "parent") {
    throw new Error("일정을 찾을 수 없어요.");
  }
  const childUserId = await resolveLinkedChildUserId(guardianUserId);
  if (!childUserId || childUserId !== existing.childUserId) {
    throw new Error("이 일정을 복제할 수 없어요.");
  }

  return createParentScheduleItem(guardianUserId, {
    type: existing.type === "treatment" ? "treatment" : "exam",
    title: existing.title,
    time: existing.time,
    dateKey: opts?.dateKey ?? existing.dateKey,
    templateId: existing.templateId,
    colorTag: existing.colorTag,
    repeatRule: "once",
    reminderMinutes: existing.reminderMinutes,
    reminderEnabled: existing.reminderEnabled,
  });
}

export async function updateParentScheduleItem(
  guardianUserId: string,
  itemId: string,
  input: UpdateHospitalScheduleInput
): Promise<HospitalDayItem> {
  const existing = await getScheduleItem(itemId);
  if (!existing || existing.source !== "parent") {
    throw new Error("일정을 찾을 수 없어요.");
  }
  if (existing.createdByGuardianId !== guardianUserId) {
    // Allow any linked guardian of this child
    const childUserId = await resolveLinkedChildUserId(guardianUserId);
    if (!childUserId || childUserId !== existing.childUserId) {
      throw new Error("이 일정을 수정할 수 없어요.");
    }
  }

  const type =
    input.type === "treatment" || input.type === "exam"
      ? input.type
      : (existing.type as "exam" | "treatment");
  const title = input.title?.trim() ?? existing.title;
  const note = input.note !== undefined ? input.note : undefined;
  const time =
    input.time === null
      ? undefined
      : input.time !== undefined
        ? input.time.trim() || undefined
        : existing.time;

  if (time && !/^\d{1,2}:\d{2}$/.test(time)) {
    throw new Error("시간은 HH:MM 형식으로 입력해 주세요. 예: 14:30");
  }

  const titleOrTypeChanged =
    title !== existing.title || type !== existing.type;
  const noteChanged = note !== undefined;
  const shouldRefreshCopy = titleOrTypeChanged || noteChanged;

  let explanation = existing.explanation;
  let childTitle = existing.childTitle;
  let whatText = existing.whatText;
  let whyText = existing.whyText;
  let notifyText = existing.notifyText;

  if (shouldRefreshCopy) {
    childTitle = softChildTitle(type, title);
    const noteForCopy = noteChanged ? note : undefined;
    const fallbackWhat =
      type === "exam"
        ? `“${title}”을(를) 살펴보는 시간이에요.`
        : `“${title}”을(를) 도와주는 시간이에요.`;
    const fallbackWhy = softExplanation(type, title, noteForCopy);

    whatText = fallbackWhat;
    whyText = fallbackWhy;
    explanation = fallbackWhy;
    notifyText =
      type === "exam"
        ? `보호자가 ${title} 검사를 알려 줬어요`
        : `보호자가 ${title} 치료를 알려 줬어요`;

    if (shouldEnrichScheduleWithLlm(title, noteForCopy)) {
      const llmCopy = await composeChildScheduleCopy({
        type,
        title,
        note: noteForCopy,
      });
      if (llmCopy) {
        whatText = llmCopy.what;
        whyText = llmCopy.why;
        explanation = llmCopy.why;
        notifyText = llmCopy.notify;
      }
    }
  }

  const updated: HospitalDayItem = {
    ...existing,
    type,
    title,
    childTitle,
    time,
    explanation,
    whatText,
    whyText,
    notifyText,
    done: typeof input.done === "boolean" ? input.done : existing.done,
    skipped:
      typeof input.skipped === "boolean" ? input.skipped : existing.skipped,
    colorTag:
      input.colorTag !== undefined ? input.colorTag : existing.colorTag,
    reminderMinutes:
      input.reminderMinutes !== undefined
        ? input.reminderMinutes
        : existing.reminderMinutes,
    reminderEnabled:
      typeof input.reminderEnabled === "boolean"
        ? input.reminderEnabled
        : existing.reminderEnabled,
    dateKey:
      typeof input.dateKey === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(input.dateKey)
        ? input.dateKey
        : existing.dateKey,
    updatedAt: new Date().toISOString(),
  };

  return saveScheduleItem(updated);
}

export async function deleteParentScheduleItem(
  guardianUserId: string,
  itemId: string
): Promise<void> {
  const existing = await getScheduleItem(itemId);
  if (!existing || existing.source !== "parent") {
    throw new Error("일정을 찾을 수 없어요.");
  }
  const childUserId = await resolveLinkedChildUserId(guardianUserId);
  if (!childUserId || childUserId !== existing.childUserId) {
    throw new Error("이 일정을 삭제할 수 없어요.");
  }
  await deleteScheduleItem(itemId);
}

/** Child marks an item done (their own schedule). */
export async function markHospitalItemDone(
  childUserId: string,
  itemId: string,
  done: boolean
): Promise<HospitalDayItem> {
  const existing = await getScheduleItem(itemId);
  if (!existing || existing.childUserId !== childUserId) {
    throw new Error("일정을 찾을 수 없어요.");
  }
  return saveScheduleItem({
    ...existing,
    done,
    updatedAt: new Date().toISOString(),
  });
}
