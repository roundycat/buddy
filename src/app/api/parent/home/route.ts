import { requireGuardianUser } from "@/backend/shared/http/auth";
import { getParentHome } from "@/backend/features/parent/parent.service";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    return getParentHome(user.id);
  }, "오늘의 마음을 불러오지 못했어요.", "[api/parent/home GET]");
}
