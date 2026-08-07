import { NextResponse } from "next/server";
import { requireAuthUser } from "@/backend/shared/http/auth";
import { readDiaryImage } from "@/backend/features/picture-diary/picture-diary.store";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/** Serve a diary drawing or photo to its owner only. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withApiGuard(
    async () => {
      const user = await requireAuthUser();
      const { id } = await context.params;
      const kind =
        new URL(request.url).searchParams.get("kind") === "photo"
          ? "photo"
          : "drawing";

      const image = await readDiaryImage(user.id, id, kind);
      if (!image) throw new HttpError("일기 그림을 찾을 수 없어요.", 404);

      return new NextResponse(new Uint8Array(image.bytes), {
        status: 200,
        headers: {
          "Content-Type": image.contentType,
          "Cache-Control": "private, max-age=300",
        },
      });
    },
    "일기 그림을 불러오지 못했어요.",
    "[api/diary/[id]/image GET]"
  );
}
