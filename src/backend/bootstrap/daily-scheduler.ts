import "server-only";
import { runDailyBatch } from "@/backend/features/batch/run-daily-batch";
import {
  markDailyBatchRun,
  tryClaimDailyBatchRun,
} from "@/backend/features/batch/batch-run.store";
import { observeFailure } from "@/backend/shared/observability";
import { todayKey } from "@/backend/shared/time/date";

/**
 * In-process dawn batch for single-instance hosting without EventBridge
 * (INPROCESS_SCHEDULER=1, e.g. Render). Every few minutes it checks whether
 * today's batch (DAILY_BATCH_KST_HOUR, default 05:00 KST) has run; the claim in
 * batch-run.store keeps it to once per day, also across restarts. A failed run
 * is retried at most twice per day.
 */

const CHECK_EVERY_MS = 5 * 60_000;
const MAX_ATTEMPTS_PER_DAY = 3;

type SchedulerState = { started: boolean; running: boolean; attempts: Map<string, number> };
const KEY = Symbol.for("beddy.dailyScheduler");

function state(): SchedulerState {
  const g = globalThis as unknown as Record<symbol, SchedulerState | undefined>;
  let s = g[KEY];
  if (!s) {
    s = { started: false, running: false, attempts: new Map() };
    g[KEY] = s;
  }
  return s;
}

function kstHour(now: Date): number {
  return (now.getUTCHours() + 9) % 24;
}

export async function runScheduledBatchIfDue(now = new Date()): Promise<"ran" | "skipped"> {
  const s = state();
  const startHour = Number(process.env.DAILY_BATCH_KST_HOUR ?? "5");
  if (s.running || kstHour(now) < (Number.isFinite(startHour) ? startHour : 5)) return "skipped";

  const dateKey = todayKey(now);
  const attempts = s.attempts.get(dateKey) ?? 0;
  if (attempts >= MAX_ATTEMPTS_PER_DAY) return "skipped";

  const claim = await tryClaimDailyBatchRun(dateKey);
  if (!claim.claimed) return "skipped";

  s.running = true;
  s.attempts.set(dateKey, attempts + 1);
  try {
    const result = await runDailyBatch(dateKey);
    await markDailyBatchRun(dateKey, "done");
    console.info(`[scheduler] daily batch ${dateKey} done`, JSON.stringify(result));
    return "ran";
  } catch (error) {
    await markDailyBatchRun(dateKey, "failed").catch(() => undefined);
    observeFailure({ feature: "batch.daily", operation: "scheduler", error, metricName: "Errors" });
    return "ran";
  } finally {
    s.running = false;
  }
}

export function startDailyScheduler() {
  if (process.env.INPROCESS_SCHEDULER !== "1") return;
  const s = state();
  if (s.started) return;
  s.started = true;
  const tick = () => {
    runScheduledBatchIfDue().catch((error) => console.warn("[scheduler] tick failed", error));
  };
  const timer = setInterval(tick, CHECK_EVERY_MS);
  timer.unref?.();
  setTimeout(tick, 60_000).unref?.();
  console.info("[scheduler] in-process daily batch scheduler on");
}
