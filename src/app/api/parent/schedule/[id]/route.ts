import { requireGuardianUser } from "@/backend/shared/http/auth";
import {
  deleteParentScheduleItem,
  duplicateParentScheduleItem,
  updateParentScheduleItem,
} from "@/backend/features/hospital-day/hospital-day.service";
import { assertLinkedChildConsented } from "@/backend/features/consent/consent.guard";
import { readJsonBody, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    await assertLinkedChildConsented(user.id);
    const params = await Promise.resolve(context.params);
    const body = await readJsonBody<{
      title?: unknown;
      time?: unknown;
      note?: unknown;
      done?: unknown;
      skipped?: unknown;
      type?: unknown;
      colorTag?: unknown;
      reminderMinutes?: unknown;
      reminderEnabled?: unknown;
      dateKey?: unknown;
      action?: unknown;
    }>(request);

    if (body?.action === "duplicate") {
      const dateKey =
        typeof body?.dateKey === "string" ? body.dateKey : undefined;
      const item = await duplicateParentScheduleItem(user.id, params.id, {
        dateKey,
      });
      return { item };
    }

    if (body?.action === "repeat-tomorrow") {
      const existingDate =
        typeof body?.dateKey === "string" ? body.dateKey : undefined;
      let tomorrow = existingDate;
      if (existingDate && /^\d{4}-\d{2}-\d{2}$/.test(existingDate)) {
        const [y, m, d] = existingDate.split("-").map(Number);
        const dt = new Date(y!, m! - 1, d!);
        dt.setDate(dt.getDate() + 1);
        tomorrow = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      }
      const item = await duplicateParentScheduleItem(user.id, params.id, {
        dateKey: tomorrow,
      });
      return { item };
    }

    const item = await updateParentScheduleItem(user.id, params.id, {
      title: typeof body?.title === "string" ? body.title : undefined,
      time:
        body?.time === null
          ? null
          : typeof body?.time === "string"
            ? body.time
            : undefined,
      note: typeof body?.note === "string" ? body.note : undefined,
      done: typeof body?.done === "boolean" ? body.done : undefined,
      skipped: typeof body?.skipped === "boolean" ? body.skipped : undefined,
      type:
        body?.type === "exam" || body?.type === "treatment"
          ? body.type
          : undefined,
      colorTag:
        typeof body?.colorTag === "string" ? body.colorTag : undefined,
      reminderMinutes:
        body?.reminderMinutes === null
          ? null
          : typeof body?.reminderMinutes === "number"
            ? body.reminderMinutes
            : undefined,
      reminderEnabled:
        typeof body?.reminderEnabled === "boolean"
          ? body.reminderEnabled
          : undefined,
      dateKey:
        typeof body?.dateKey === "string" ? body.dateKey : undefined,
    });
    return { item };
  }, "일정을 수정하지 못했어요.", "[api/parent/schedule PATCH]");
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    const params = await Promise.resolve(context.params);
    await deleteParentScheduleItem(user.id, params.id);
    return { ok: true };
  }, "일정을 삭제하지 못했어요.", "[api/parent/schedule DELETE]");
}
