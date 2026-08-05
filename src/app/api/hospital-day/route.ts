import { requireAuthUser, requireChildUser } from "@/backend/shared/http/auth";
import {
  getHospitalDay,
  getHospitalScheduleMonth,
  markHospitalItemDone,
} from "@/backend/features/hospital-day/hospital-day.service";
import { todayKey } from "@/backend/shared/time/date";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/**
 * Child: hospital schedule by date, or month calendar overview.
 * ?date=YYYY-MM-DD | ?month=YYYY-MM
 */
export async function GET(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const date = searchParams.get("date");

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        throw new HttpError("월 형식이 올바르지 않아요. 예: 2026-08", 400);
      }
      return getHospitalScheduleMonth(user.id, month);
    }

    const dateKey = date?.trim() || todayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new HttpError("날짜 형식이 올바르지 않아요. 예: 2026-08-04", 400);
    }
    return getHospitalDay(user.id, dateKey);
  }, "일정을 불러올 수 없습니다.", "[api/hospital-day GET]");
}

/**
 * Child marks a schedule item done.
 */
export async function PATCH(request: Request) {
  return withApiGuard(async () => {
    const user = await requireChildUser();
    const body = await readJsonBody<{ id?: unknown; done?: unknown }>(request);
    const id = typeof body?.id === "string" ? body.id : "";
    const done = body?.done === true;
    if (!id) throw new HttpError("일정 id가 필요해요.", 400);
    try {
      const item = await markHospitalItemDone(user.id, id, done);
      return { item };
    } catch (error) {
      throw new HttpError(
        error instanceof Error ? error.message : "일정을 업데이트하지 못했어요.",
        400
      );
    }
  }, "일정을 업데이트하지 못했어요.", "[api/hospital-day PATCH]");
}
