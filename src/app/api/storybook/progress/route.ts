import { requireChildUser } from "@/backend/shared/http/auth";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";
import { saveStorybookProgress } from "@/backend/features/growth-storybook/growth-storybook.store";

export async function PATCH(request: Request) {
  return withApiGuard(
    async () => {
      const user = await requireChildUser();
      const body = (await request.json().catch(() => null)) as {
        pageIndex?: number;
        completed?: boolean;
      } | null;
      if (!body || typeof body.pageIndex !== "number") {
        throw new HttpError("읽던 페이지를 확인하지 못했어요.", 400);
      }
      const progress = await saveStorybookProgress({
        userId: user.id,
        pageIndex: body.pageIndex,
        completed: body.completed === true,
      });
      return { progress };
    },
    "읽던 페이지를 저장하지 못했어요.",
    "[api/storybook/progress PATCH]"
  );
}
