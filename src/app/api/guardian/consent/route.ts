import { requireGuardianUser } from "@/backend/shared/http/auth";
import {
  getGuardianConsentView,
  grantGuardianConsent,
  withdrawGuardianConsent,
} from "@/backend/features/consent/consent.service";
import { readJsonBody, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/** Consent status for the linked child (under 14 → legal guardian consent). */
export async function GET() {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    return getGuardianConsentView(user.id);
  }, "동의 상태를 불러오지 못했어요.", "[api/guardian/consent GET]");
}

/** Legal guardian gives consent (개인정보 보호법 제22조의2 · 제23조). */
export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    const body = await readJsonBody<{
      relationship?: unknown;
      guardianName?: unknown;
      items?: {
        privacyCollection?: unknown;
        sensitiveData?: unknown;
        aiFeatures?: unknown;
      };
    }>(request);
    return grantGuardianConsent(user.id, {
      relationship: body?.relationship,
      guardianName: body?.guardianName,
      items: body?.items,
    });
  }, "동의를 저장하지 못했어요.", "[api/guardian/consent POST]");
}

/** 동의 철회 — the child goes back to pending. */
export async function DELETE() {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    return withdrawGuardianConsent(user.id);
  }, "동의를 철회하지 못했어요.", "[api/guardian/consent DELETE]");
}
