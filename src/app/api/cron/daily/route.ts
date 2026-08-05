import { assertCronAuthorized } from "@/backend/features/batch/cron-auth";
import { runDailyBatch } from "@/backend/features/batch/run-daily-batch";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";
import { todayKey } from "@/backend/shared/time/date";

export const maxDuration = 300;

/**
 * Dawn cron — EventBridge API Destination target.
 * POST /api/cron/daily
 * Header: x-bedi-cron-secret
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
      const result = await runDailyBatch(dateKey);
      return { ok: true, result };
    },
    "배치 실행에 실패했습니다.",
    "[api/cron/daily POST]"
  );
}
