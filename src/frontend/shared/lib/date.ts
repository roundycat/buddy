/**
 * Client-safe date display helpers (no Node APIs).
 * Keep formatting out of `@/backend` so Client Components never pull server modules.
 */

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
