import { requireGuardianUser } from "@/backend/shared/http/auth";
import {
  createParentScheduleItems,
  listParentSchedule,
} from "@/backend/features/hospital-day/hospital-day.service";
import type { ScheduleRepeatRule } from "@/backend/features/hospital-day/hospital-day.types";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";
import { todayKey } from "@/backend/shared/time/date";

export const dynamic = "force-dynamic";

const REPEAT_RULES = new Set<ScheduleRepeatRule>([
  "once",
  "daily",
  "weekdays",
  "weekly",
  "monthly",
  "custom",
]);

export async function GET(request: Request) {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    const { searchParams } = new URL(request.url);
    const dateKey = searchParams.get("date") || todayKey();
    return listParentSchedule(user.id, dateKey);
  }, "일정을 불러오지 못했어요.", "[api/parent/schedule GET]");
}

export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    const body = await readJsonBody<{
      type?: unknown;
      title?: unknown;
      time?: unknown;
      note?: unknown;
      dateKey?: unknown;
      templateId?: unknown;
      colorTag?: unknown;
      repeatRule?: unknown;
      repeatWeekdays?: unknown;
      repeatCount?: unknown;
      reminderMinutes?: unknown;
      reminderEnabled?: unknown;
    }>(request);

    const type = body?.type === "treatment" ? "treatment" : "exam";
    const title = typeof body?.title === "string" ? body.title : "";
    const time = typeof body?.time === "string" ? body.time : undefined;
    const note = typeof body?.note === "string" ? body.note : undefined;
    const dateKey =
      typeof body?.dateKey === "string" ? body.dateKey : undefined;
    const templateId =
      typeof body?.templateId === "string" ? body.templateId : undefined;
    const colorTag =
      typeof body?.colorTag === "string" ? body.colorTag : undefined;
    const repeatRuleRaw =
      typeof body?.repeatRule === "string" ? body.repeatRule : "once";
    const repeatRule = REPEAT_RULES.has(repeatRuleRaw as ScheduleRepeatRule)
      ? (repeatRuleRaw as ScheduleRepeatRule)
      : "once";
    const repeatWeekdays = Array.isArray(body?.repeatWeekdays)
      ? body.repeatWeekdays.filter(
          (n): n is number => typeof n === "number" && n >= 0 && n <= 6
        )
      : undefined;
    const repeatCount =
      typeof body?.repeatCount === "number" ? body.repeatCount : undefined;
    const reminderMinutes =
      body?.reminderMinutes === null
        ? null
        : typeof body?.reminderMinutes === "number"
          ? body.reminderMinutes
          : undefined;
    const reminderEnabled =
      typeof body?.reminderEnabled === "boolean"
        ? body.reminderEnabled
        : undefined;

    if (!title.trim()) {
      throw new HttpError("일정 이름을 입력해 주세요.", 400);
    }

    try {
      const items = await createParentScheduleItems(user.id, {
        type,
        title,
        time,
        note,
        dateKey,
        templateId,
        colorTag,
        repeatRule,
        repeatWeekdays,
        repeatCount,
        reminderMinutes,
        reminderEnabled,
      });
      return { item: items[0], items, count: items.length };
    } catch (error) {
      throw new HttpError(
        error instanceof Error ? error.message : "일정을 저장하지 못했어요.",
        400
      );
    }
  }, "일정을 저장하지 못했어요.", "[api/parent/schedule POST]");
}
