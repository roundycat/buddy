"use client";

import { MoreHorizontal } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";
import { getScheduleTemplate } from "@/frontend/features/parent/lib/schedule-templates";
import { ScheduleTemplateIconView } from "@/frontend/features/parent/components/schedule/ScheduleTemplateSelector";

export type ScheduleCardItem = {
  id: string;
  type: string;
  title: string;
  time?: string;
  done?: boolean;
  skipped?: boolean;
  templateId?: string;
  colorTag?: string;
  repeatLabel?: string;
  reminderEnabled?: boolean;
  reminderMinutes?: number | null;
};

/**
 * Adult schedule row — icon, time, status. No emoji.
 */
export function ScheduleCard({
  item,
  onOpenActions,
}: {
  item: ScheduleCardItem;
  onOpenActions: () => void;
}) {
  const template = getScheduleTemplate(item.templateId);
  const status = item.skipped
    ? "건너뜀"
    : item.done
      ? "완료"
      : "예정";

  return (
    <button
      type="button"
      onClick={onOpenActions}
      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
        aria-hidden
      >
        {template ? (
          <ScheduleTemplateIconView icon={template.icon} className="h-4 w-4" />
        ) : (
          <span className="text-[11px] font-semibold uppercase">
            {item.type === "treatment" ? "치료" : "검사"}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-semibold text-slate-800">
            {item.title}
          </p>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
              item.skipped
                ? "bg-slate-100 text-slate-500"
                : item.done
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-800 text-white"
            )}
          >
            {status}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] text-slate-500">
          {item.time ? item.time : "시간 미정"}
          {item.repeatLabel ? ` · ${item.repeatLabel}` : ""}
          {item.reminderEnabled && item.reminderMinutes
            ? ` · ${item.reminderMinutes}분 전`
            : ""}
        </p>
      </div>
      <MoreHorizontal className="h-4 w-4 shrink-0 text-slate-300" />
    </button>
  );
}
