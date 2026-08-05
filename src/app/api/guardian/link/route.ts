import { requireGuardianUser } from "@/backend/shared/http/auth";
import {
  getGuardianLinkStatus,
  linkGuardianWithCode,
  unlinkGuardian,
} from "@/backend/features/guardian-link/guardian-link.service";
import { withApiGuard, readJsonBody } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/** Current guardian ↔ child link status */
export async function GET() {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    return getGuardianLinkStatus(user.id);
  }, "연결 상태를 불러오지 못했어요.", "[api/guardian/link GET]");
}

/** Redeem child invite code */
export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    const body = await readJsonBody<{ code?: unknown }>(request);
    const code = typeof body?.code === "string" ? body.code : "";
    return linkGuardianWithCode(user.id, code);
  }, "아이와 연결하지 못했어요.", "[api/guardian/link POST]");
}

/** Unlink child */
export async function DELETE() {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    await unlinkGuardian(user.id);
    return { linked: false };
  }, "연결을 해제하지 못했어요.", "[api/guardian/link DELETE]");
}
