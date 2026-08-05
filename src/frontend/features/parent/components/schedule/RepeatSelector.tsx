"use client";

import { cn } from "@/frontend/shared/lib/utils";
import {
  REPEAT_OPTIONS,
  type RepeatOptionId,
} from "@/frontend/features/parent/lib/schedule-templates";

const WEEKDAY_CHIPS: Array<{ value: number; label: string }> = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 0, label: "일" },
];

/**
 * One-tap repeat picker for recurring hospital schedules.
 */
export function RepeatSelector({
  value,
  weekdays,
  onChange,
  onWeekdaysChange,
}: {
  value: RepeatOptionId;
  weekdays: number[];
  onChange: (rule: RepeatOptionId) => void;
  onWeekdaysChange: (days: number[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {REPEAT_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                "min-h-11 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
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
      {value === "custom" ? (
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_CHIPS.map((chip) => {
            const on = weekdays.includes(chip.value);
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => {
                  onWeekdaysChange(
                    on
                      ? weekdays.filter((d) => d !== chip.value)
                      : [...weekdays, chip.value].sort((a, b) => a - b)
                  );
                }}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full border text-sm font-medium",
                  on
                    ? "border-slate-700 bg-slate-800 text-white"
                    : "border-slate-200 bg-white text-slate-500"
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">
          {REPEAT_OPTIONS.find((o) => o.id === value)?.hint}
        </p>
      )}
    </div>
  );
}
