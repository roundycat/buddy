import { NextResponse } from "next/server";
import { requireChildUser } from "@/backend/shared/http/auth";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";
import {
  ensureStorybookIllustration,
  readStorybookIllustration,
} from "@/backend/features/growth-storybook/storybook-illustration.service";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withApiGuard(
    async () => {
      const user = await requireChildUser();
      const { id } = await context.params;
      const image = await readStorybookIllustration(user.id, id);
      if (!image) throw new HttpError("삽화를 찾을 수 없어요.", 404);
      return new NextResponse(new Uint8Array(image.bytes), {
        headers: {
          "Content-Type": image.contentType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    },
    "삽화를 불러오지 못했어요.",
    "[api/storybook/page/illustration GET]"
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withApiGuard(
    async () => {
      const user = await requireChildUser();
      await assertChildConsented(user);
      const { id } = await context.params;
      const result = await ensureStorybookIllustration(user.id, id);
      if (!result) throw new HttpError("이야기 페이지를 찾을 수 없어요.", 404);
      return {
        imageStatus: result.page.illustration?.imageStatus,
        imageUrl: result.page.illustration?.imageUrl,
      };
    },
    "삽화를 그리지 못했어요.",
    "[api/storybook/page/illustration POST]"
  );
}
