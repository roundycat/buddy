import { requireAuthUser } from "@/backend/shared/http/auth";
import { choosePersonaAvatar } from "@/backend/features/persona/persona.service";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/**
 * Confirm which crayon avatar candidate becomes the active persona image.
 */
export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    await assertChildConsented(user.id);
    const body = await readJsonBody<{ candidateId?: unknown }>(request);
    const candidateId =
      typeof body?.candidateId === "string" || typeof body?.candidateId === "number"
        ? String(body.candidateId)
        : "";

    if (!candidateId) {
      throw new HttpError("그림을 선택해 주세요.", 400);
    }

    return choosePersonaAvatar(user.id, candidateId);
  }, "아바타를 저장하지 못했어요.", "[api/persona/avatar/select POST]");
}
