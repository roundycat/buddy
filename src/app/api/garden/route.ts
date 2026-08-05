import { requireAuthUser } from "@/backend/shared/http/auth";
import { getEmotionGarden } from "@/backend/features/emotion-garden/emotion-garden.service";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    return getEmotionGarden(user.id);
  }, "정원을 불러오지 못했어요.", "[api/garden GET]");
}
