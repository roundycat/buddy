import { requireChildUser } from "@/backend/shared/http/auth";
import {
  getChildSharingView,
  updateChildShareChoices,
} from "@/backend/features/sharing/sharing.service";
import { readJsonBody, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/** Child: what I share with my guardians (보호자와 나누기). */
export async function GET() {
  return withApiGuard(async () => {
    const user = await requireChildUser();
    return getChildSharingView(user.id);
  }, "나누기 설정을 불러오지 못했어요.", "[api/sharing GET]");
}

/** Child: change one or more categories → { choices: { media: "share" } } */
export async function PATCH(request: Request) {
  return withApiGuard(async () => {
    const user = await requireChildUser();
    const body = await readJsonBody<{ choices?: unknown }>(request);
    const choices =
      body?.choices && typeof body.choices === "object"
        ? (body.choices as Record<string, unknown>)
        : null;
    return updateChildShareChoices(user.id, choices);
  }, "나누기 설정을 저장하지 못했어요.", "[api/sharing PATCH]");
}
