import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/backend/features/batch/cron-auth";
import { runDailyBatch } from "@/backend/features/batch/run-daily-batch";
import {
  markDailyBatchRun,
  tryClaimDailyBatchRun,
} from "@/backend/features/batch/batch-run.store";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";
import { observeFailure } from "@/backend/shared/observability";
import { todayKey } from "@/backend/shared/time/date";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function scheduleDailyBatch(dateKey: string) {
  void (async () => {
    try {
      await runDailyBatch(dateKey);
      await markDailyBatchRun(dateKey, "done");
    } catch (error) {
      try {
        await markDailyBatchRun(dateKey, "failed");
      } catch (markError) {
        observeFailure({
          feature: "batch.daily",
          operation: "mark_failed",
          error: markError,
          metricName: "Errors",
        });
      }
      observeFailure({
        feature: "batch.daily",
        operation: "run",
        error,
        metricName: "Errors",
      });
    }
  })();
}

/**
 * Dawn cron — EventBridge API Destination target.
 * POST /api/cron/daily
 * Header: x-bedi-cron-secret
 *
 * Returns 202 immediately (API Destination ≤5s). Batch runs in-process.
 * Idempotent per dateKey unless ?force=1.
 */
export async function POST(request: Request) {
  return withApiGuard(
    async () => {
      assertCronAuthorized(request);
      const url = new URL(request.url);
      const dateKey = url.searchParams.get("date")?.trim() || todayKey();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        throw new HttpError("Invalid date", 400);
      }
      const force = url.searchParams.get("force") === "1";

      const claim = await tryClaimDailyBatchRun(dateKey, force);
      if (!claim.claimed) {
        return NextResponse.json(
          {
            ok: true,
            skipped: true,
            dateKey,
            status: claim.record?.status ?? "unknown",
          },
          { status: 202 }
        );
      }

      scheduleDailyBatch(dateKey);
      return NextResponse.json(
        { ok: true, accepted: true, dateKey },
        { status: 202 }
      );
    },
    "배치 실행에 실패했습니다.",
    "[api/cron/daily POST]"
  );
}
