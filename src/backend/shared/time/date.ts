/**
 * Shared date helpers for hospital-day / adventure / garden keys.
 * TODO [AWS]: prefer UTC date keys or hospital-local TZ from user profile.
 */

/** Local calendar date as YYYY-MM-DD */
export function todayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Compact Korean date label, e.g. 8월 4일 */
export function formatKoreanMonthDay(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** Wallet ledger style: M/D HH:mm */
export function formatKoreanShortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

/** Whole calendar days between two instants (local TZ), truncated. */
export function calendarDaysBetween(
  start: string | Date,
  end: Date = new Date()
): number {
  const a = typeof start === "string" ? new Date(start) : start;
  if (Number.isNaN(a.getTime())) return 0;
  const startUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / 86_400_000);
}

/**
 * "N일째" from a journey start — day 1 is the start date itself.
 * Independent of EventBridge; advances with the calendar midnight.
 */
export function hospitalDayCount(
  journeyStartedAt: string | Date | undefined,
  fallback = 1,
  now: Date = new Date()
): number {
  if (!journeyStartedAt) return Math.max(1, fallback);
  return Math.max(1, calendarDaysBetween(journeyStartedAt, now) + 1);
}
