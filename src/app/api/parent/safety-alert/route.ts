import { requireGuardianUser } from "@/backend/shared/http/auth";
import { withApiGuard } from "@/backend/shared/http/route";
import { resolveLinkedChildUserId } from "@/backend/features/guardian-link/guardian-link.service";
import { acknowledgeChildSafetyAlert } from "@/backend/features/safety/safety-alert.store";
import { getParentSafetyAlert } from "@/backend/features/parent/parent.service";

export const dynamic = "force-dynamic";

/** Acknowledge active child safety alert (summary-only notice). */
export async function POST() {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    const childUserId = await resolveLinkedChildUserId(user.id);
    if (!childUserId) {
      return { ok: false as const, alert: null };
    }
    const alert = await acknowledgeChildSafetyAlert(childUserId);
    return { ok: true as const, alert };
  }, "안전 알림을 확인하지 못했어요.", "[api/parent/safety-alert POST]");
}

export async function GET() {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    // Same rule as the guardian home: "help is needed" only, never content
    return { alert: await getParentSafetyAlert(user.id) };
  }, "안전 알림을 불러오지 못했어요.", "[api/parent/safety-alert GET]");
}
