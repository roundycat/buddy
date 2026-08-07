import { getTimeline } from "@/backend/features/timeline/timeline.service";
import { getSessionUser } from "@/backend/shared/http/auth";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/**
 * API Bridge: Timeline
 * Frontend calls this route — never imports backend services directly.
 */
export async function GET() {
  return withApiGuard(async () => {
    const user = await getSessionUser();
    return getTimeline(user?.id);
  }, "타임라인 데이터를 불러올 수 없습니다.", "[api/timeline]");
}
