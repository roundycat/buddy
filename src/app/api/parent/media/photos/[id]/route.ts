import { NextResponse } from "next/server";
import { requireGuardianUser } from "@/backend/shared/http/auth";
import {
  readParentChildPhotoBytes,
  requireLinkedChildForGuardian,
} from "@/backend/features/parent/parent-media.service";
import { getParentSettings } from "@/backend/features/parent/parent-settings.store";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/** Linked guardian → child's album photo bytes. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withApiGuard(
    async () => {
      const guardian = await requireGuardianUser();
      const settings = await getParentSettings(guardian.id);
      if (!settings.privacy.shareMemoryHighlights) {
        throw new HttpError("사진 공유가 꺼져 있어요.", 403);
      }

      const childUserId = await requireLinkedChildForGuardian(guardian.id);
      const { id } = await context.params;
      const photo = await readParentChildPhotoBytes(childUserId, id);
      if (!photo) throw new HttpError("사진을 찾을 수 없어요.", 404);

      return new NextResponse(new Uint8Array(photo.bytes), {
        status: 200,
        headers: {
          "Content-Type": photo.contentType,
          "Cache-Control": "private, max-age=120",
        },
      });
    },
    "사진을 불러오지 못했어요.",
    "[api/parent/media/photos/[id] GET]"
  );
}
