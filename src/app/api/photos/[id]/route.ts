import { NextResponse } from "next/server";
import { requireAuthUser } from "@/backend/shared/http/auth";
import { getAlbumPhotoBytes } from "@/backend/features/photo-album/photo-album.service";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/** Serve a single album photo for the owner. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const photo = await getAlbumPhotoBytes(user.id, id);
    if (!photo) throw new HttpError("사진을 찾을 수 없어요.", 404);

    return new NextResponse(new Uint8Array(photo.bytes), {
      status: 200,
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, max-age=120",
      },
    });
  }, "사진을 불러오지 못했어요.", "[api/photos/[id] GET]");
}
