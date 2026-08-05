import { requireGuardianUser } from "@/backend/shared/http/auth";
import { getParentTimeline } from "@/backend/features/parent/parent.service";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || undefined;
    return getParentTimeline(user.id, month);
  }, "여정을 불러오지 못했어요.", "[api/parent/timeline GET]");
}
