"use client";

import { cn } from "@/frontend/shared/lib/utils";
import { REMINDER_OPTIONS } from "@/frontend/features/parent/lib/schedule-templates";

/**
 * Reminder lead-time chips for parent schedule alerts.
 */
export function ReminderSettings({
  minutes,
  enabled,
  onChange,
}: {
  minutes: number | null;
  enabled: boolean;
  onChange: (next: { minutes: number | null; enabled: boolean }) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-slate-500">알림</p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() =>
            onChange({
              minutes: enabled ? null : minutes ?? 10,
              enabled: !enabled,
            })
          }
          className={cn(
            "relative h-7 w-12 rounded-full transition-colors",
            enabled ? "bg-slate-800" : "bg-bedi-slate/15"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-softer transition-transform",
              enabled ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>
      {enabled ? (
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_OPTIONS.filter((o) => o.minutes != null).map((opt) => {
            const selected = minutes === opt.minutes;
            return (
              <button
                key={String(opt.minutes)}
                type="button"
                onClick={() =>
                  onChange({ minutes: opt.minutes, enabled: true })
                }
                className={cn(
                  "min-h-11 rounded-full border px-3.5 text-[13px] font-medium",
                  selected
                    ? "border-slate-700 bg-slate-100 text-slate-800"
                    : "border-slate-200 bg-white text-slate-500"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">
          알림 시각을 일정과 함께 저장해 둘 수 있어요. 휴대폰 알림은 다음
          버전에서 지원해요.
        </p>
      )}
    </div>
  );
}
