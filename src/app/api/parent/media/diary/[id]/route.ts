import { NextResponse } from "next/server";
import { requireGuardianUser } from "@/backend/shared/http/auth";
import {
  readParentChildDiaryImage,
  requireLinkedChildForGuardian,
} from "@/backend/features/parent/parent-media.service";
import { getParentSettings } from "@/backend/features/parent/parent-settings.store";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/** Linked guardian → child's diary drawing or photo bytes. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withApiGuard(
    async () => {
      const guardian = await requireGuardianUser();
      const settings = await getParentSettings(guardian.id);
      if (!settings.privacy.shareMemoryHighlights) {
        throw new HttpError("그림·사진 공유가 꺼져 있어요.", 403);
      }

      const childUserId = await requireLinkedChildForGuardian(guardian.id);
      const { id } = await context.params;
      const kind =
        new URL(request.url).searchParams.get("kind") === "photo"
          ? "photo"
          : "drawing";

      const image = await readParentChildDiaryImage(childUserId, id, kind);
      if (!image) throw new HttpError("일기 그림을 찾을 수 없어요.", 404);

      return new NextResponse(new Uint8Array(image.bytes), {
        status: 200,
        headers: {
          "Content-Type": image.contentType,
          "Cache-Control": "private, max-age=120",
        },
      });
    },
    "일기 그림을 불러오지 못했어요.",
    "[api/parent/media/diary/[id] GET]"
  );
}
