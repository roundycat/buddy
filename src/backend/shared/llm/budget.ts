/**
 * Daily AI usage caps — a circuit breaker for public demos and voting days.
 *
 * In-process counters (single task). When a cap is reached:
 * - LLM calls fall back to the offline mock persona (the app keeps working, no cost)
 * - image generation returns the pre-made crayon style image or fails softly
 *
 * Env: AI_DAILY_LLM_CAP (default 6000 calls), AI_DAILY_IMAGE_CAP (default 200 images).
 * 0 or a negative number means "no cap".
 */

export type BudgetKind = "llm" | "image";

const DEFAULT_CAPS: Record<BudgetKind, number> = { llm: 6000, image: 200 };

let dayKey = "";
const used: Record<BudgetKind, number> = { llm: 0, image: 0 };
const warned: Record<BudgetKind, boolean> = { llm: false, image: false };

function kstDayKey(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

function capFor(kind: BudgetKind): number {
  const raw = process.env[kind === "llm" ? "AI_DAILY_LLM_CAP" : "AI_DAILY_IMAGE_CAP"];
  const parsed = raw == null || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_CAPS[kind];
}

function roll(now = new Date()) {
  const today = kstDayKey(now);
  if (today !== dayKey) {
    dayKey = today;
    used.llm = 0;
    used.image = 0;
    warned.llm = false;
    warned.image = false;
  }
}

/** Take one unit of today's budget. Returns false when the cap is reached. */
export function takeDailyBudget(kind: BudgetKind, now = new Date()): boolean {
  roll(now);
  const cap = capFor(kind);
  if (cap <= 0) return true;
  if (used[kind] >= cap) {
    if (!warned[kind]) {
      warned[kind] = true;
      console.warn(`[budget] daily ${kind} cap reached (${cap}) — falling back`);
    }
    return false;
  }
  used[kind] += 1;
  return true;
}

export function dailyBudgetStatus(now = new Date()) {
  roll(now);
  return {
    day: dayKey,
    llm: { used: used.llm, cap: capFor("llm") },
    image: { used: used.image, cap: capFor("image") },
  };
}

/** Test helper */
export function resetDailyBudget() {
  dayKey = "";
  used.llm = 0;
  used.image = 0;
  warned.llm = false;
  warned.image = false;
}
