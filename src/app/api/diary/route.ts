import { requireAuthUser } from "@/backend/shared/http/auth";
import {
  createDiaryEntry,
  getPictureDiary,
} from "@/backend/features/picture-diary/picture-diary.service";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/** List the signed-in child's diary pages. */
export async function GET() {
  return withApiGuard(
    async () => {
      const user = await requireAuthUser();
      return getPictureDiary(user.id);
    },
    "그림 일기를 불러오지 못했어요.",
    "[api/diary GET]"
  );
}

/** Save one diary page — drawing, photo and a short note are all optional. */
export async function POST(request: Request) {
  return withApiGuard(
    async () => {
      const user = await requireAuthUser();
      const body = (await request.json().catch(() => null)) as {
        text?: string;
        drawingBase64?: string;
        photoBase64?: string;
        photoContentType?: string;
      } | null;

      if (!body) throw new HttpError("일기 내용을 읽지 못했어요.", 400);

      try {
        const entry = await createDiaryEntry({
          userId: user.id,
          text: body.text,
          drawingBase64: body.drawingBase64,
          photoBase64: body.photoBase64,
          photoContentType: body.photoContentType,
        });
        return { entry };
      } catch (error) {
        throw new HttpError(
          error instanceof Error ? error.message : "일기를 저장하지 못했어요.",
          400
        );
      }
    },
    "일기를 저장하지 못했어요.",
    "[api/diary POST]"
  );
}
