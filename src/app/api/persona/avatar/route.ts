import { NextResponse } from "next/server";
import { requireAuthUser } from "@/backend/shared/http/auth";
import { readAvatarImage } from "@/backend/features/persona/avatar.store";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/**
 * Serve the signed-in user's crayon persona avatar.
 * Optional ?c=0|1 for onboarding candidate previews.
 */
export async function GET(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    const { searchParams } = new URL(request.url);
    const candidate = searchParams.get("c") ?? undefined;
    const image = await readAvatarImage(user.id, candidate || undefined);
    if (!image) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(new Uint8Array(image.bytes), {
      status: 200,
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  }, "아바타를 불러오지 못했어요.", "[api/persona/avatar GET]");
}
