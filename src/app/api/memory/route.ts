import { getMemoryTimeline } from "@/backend/features/memory-timeline/memory-timeline.service";
import { getSessionUser } from "@/backend/shared/http/auth";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/**
 * API Bridge: AI Memory Timeline
 */
export async function GET() {
  return withApiGuard(async () => {
    const user = await getSessionUser();
    return getMemoryTimeline(user?.id);
  }, "기억 타임라인을 불러올 수 없습니다.", "[api/memory]");
}
