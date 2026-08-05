import { NextResponse } from "next/server";
import { getSessionUser } from "@/backend/shared/http/auth";
import { getScheduleItem } from "@/backend/features/hospital-day/hospital-day.store";
import { ensureScheduleImage } from "@/backend/features/hospital-day/schedule-image.generate";
import { readScheduleImage } from "@/backend/features/hospital-day/schedule-image.store";
import { withApiGuard, HttpError } from "@/backend/shared/http/route";
import { resolveLinkedChildUserId } from "@/backend/features/guardian-link/guardian-link.service";
import type { HospitalDayItem } from "@/backend/features/hospital-day/hospital-day.types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function assertCanAccessSchedule(itemId: string): Promise<HospitalDayItem> {
  const user = await getSessionUser();
  if (!user) throw new HttpError("로그인이 필요합니다.", 401);

  const item = await getScheduleItem(itemId);
  if (!item) throw new HttpError("일정을 찾을 수 없어요.", 404);

  if (user.id === item.childUserId) return item;

  if (user.role === "guardian") {
    const linked = await resolveLinkedChildUserId(user.id);
    if (linked && linked === item.childUserId) return item;
    if (item.createdByGuardianId === user.id) return item;
  }

  throw new HttpError("이 일정을 볼 수 없어요.", 403);
}

/**
 * Serve generated schedule illustration PNG.
 */
export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    const itemId = context.params.id;
    await assertCanAccessSchedule(itemId);

    const file = await readScheduleImage(itemId);
    if (!file) {
      return NextResponse.json(
        { error: "이미지가 아직 없어요." },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "이미지를 불러오지 못했어요.";
    const status = error instanceof HttpError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * Generate or refresh schedule illustration. Returns status + imageUrl.
 */
export async function POST(
  _request: Request,
  context: { params: { id: string } }
) {
  return withApiGuard(async () => {
    const itemId = context.params.id;
    await assertCanAccessSchedule(itemId);

    const item = await ensureScheduleImage(itemId);
    if (!item) throw new HttpError("일정을 찾을 수 없어요.", 404);

    return {
      id: item.id,
      imageStatus: item.imageStatus ?? "failed",
      imageUrl:
        item.imageStatus === "ready"
          ? item.imageUrl ||
            `/api/hospital-day/image/${encodeURIComponent(item.id)}?v=${Date.now()}`
          : null,
    };
  }, "일정 이미지를 만들지 못했어요.", "[api/hospital-day/image POST]");
}
