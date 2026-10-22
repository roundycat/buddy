import { requireAuthUser } from "@/backend/shared/http/auth";
import { getEmotionGarden } from "@/backend/features/emotion-garden/emotion-garden.service";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    // May ask the LLM for today's seed suggestion
    await assertChildConsented(user.id);
    return getEmotionGarden(user.id);
  }, "정원을 불러오지 못했어요.", "[api/garden GET]");
}
