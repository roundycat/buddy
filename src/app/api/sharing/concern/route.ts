import { requireChildUser } from "@/backend/shared/http/auth";
import {
  answerConcernRequest,
  getPendingConcernRequest,
} from "@/backend/features/sharing/concern-request.service";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";

export const dynamic = "force-dynamic";

function toChildView(
  request: Awaited<ReturnType<typeof getPendingConcernRequest>>
) {
  if (!request) return null;
  return {
    id: request.id,
    summary: request.summary,
    status: request.status,
    createdAt: request.createdAt,
  };
}

/** Child: is there a "may I tell your guardian?" question waiting? */
export async function GET() {
  return withApiGuard(async () => {
    const user = await requireChildUser();
    return { request: toChildView(await getPendingConcernRequest(user.id)) };
  }, "질문을 불러오지 못했어요.", "[api/sharing/concern GET]");
}

/** Child answers: { requestId, approve } — 알려도 돼 / 아직은 싫어 */
export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireChildUser();
    await assertChildConsented(user);
    const body = await readJsonBody<{ requestId?: unknown; approve?: unknown }>(
      request
    );
    const requestId = typeof body?.requestId === "string" ? body.requestId : "";
    if (!requestId || typeof body?.approve !== "boolean") {
      throw new HttpError("대답을 다시 골라 줘.", 400);
    }
    const answered = await answerConcernRequest(
      user.id,
      requestId,
      body.approve
    );
    return { request: toChildView(answered) };
  }, "대답을 저장하지 못했어요.", "[api/sharing/concern POST]");
}
