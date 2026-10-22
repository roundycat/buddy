import { requireChildUser } from "@/backend/shared/http/auth";
import { getChildConsentView } from "@/backend/features/consent/consent.service";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/** Child: my legal-guardian consent status (polled by the waiting screen). */
export async function GET() {
  return withApiGuard(async () => {
    const user = await requireChildUser();
    return getChildConsentView(user.id);
  }, "동의 상태를 불러오지 못했어요.", "[api/consent GET]");
}
