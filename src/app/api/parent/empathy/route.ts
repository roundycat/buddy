import { requireGuardianUser } from "@/backend/shared/http/auth";
import { getParentHome } from "@/backend/features/parent/parent.service";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Today's Empathy Guide — returns home payload slice (guide is generated in getParentHome).
 * Refresh: client can re-fetch /api/parent/home; this route exposes guide explicitly.
 */
export async function GET() {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    const home = await getParentHome(user.id);
    return {
      linked: home.linked,
      empathyGuide: home.empathyGuide,
      companionNote: home.companionNote,
    };
  }, "공감 가이드를 불러오지 못했어요.", "[api/parent/empathy GET]");
}
