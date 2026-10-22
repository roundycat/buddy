import { NextResponse } from "next/server";
import { requireGuardianUser } from "@/backend/shared/http/auth";
import {
  readParentChildPhotoBytes,
  requireGuardianMediaAccess,
} from "@/backend/features/parent/parent-media.service";
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
      // Child shares media AND guardian toggle on — else 403
      const childUserId = await requireGuardianMediaAccess(guardian.id);
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
