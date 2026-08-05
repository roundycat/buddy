import { requireChildUser } from "@/backend/shared/http/auth";
import {
  getOrCreateChildInvite,
  rotateChildInvite,
} from "@/backend/features/guardian-link/guardian-link.service";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/**
 * Child invite code — show parents so they can link on /guardian.
 */
export async function GET() {
  return withApiGuard(async () => {
    const user = await requireChildUser();
    return getOrCreateChildInvite(user.id);
  }, "초대 코드를 불러오지 못했어요.", "[api/guardian/invite GET]");
}

/** Rotate to a fresh code */
export async function POST() {
  return withApiGuard(async () => {
    const user = await requireChildUser();
    return rotateChildInvite(user.id);
  }, "초대 코드를 새로 만들지 못했어요.", "[api/guardian/invite POST]");
}
