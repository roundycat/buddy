import { requireGuardianUser } from "@/backend/shared/http/auth";
import { askParentReport } from "@/backend/features/parent/parent.service";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    return askParentReport(user.id, "");
  }, "리포트를 불러오지 못했어요.", "[api/parent/report GET]");
}

export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    const body = await readJsonBody<{ question?: unknown }>(request);
    const question =
      typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) {
      throw new HttpError("질문을 입력해 주세요.", 400);
    }
    return askParentReport(user.id, question);
  }, "답변을 만들지 못했어요.", "[api/parent/report POST]");
}
