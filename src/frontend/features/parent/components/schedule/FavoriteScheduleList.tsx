"use client";

import { Star } from "lucide-react";
import {
  SCHEDULE_TEMPLATES,
  type ScheduleTemplateId,
} from "@/frontend/features/parent/lib/schedule-templates";
import { ScheduleTemplateIconView } from "@/frontend/features/parent/components/schedule/ScheduleTemplateSelector";

/**
 * Pinned favorites — text + icon chips only.
 */
export function FavoriteScheduleList({
  favoriteIds,
  onPick,
}: {
  favoriteIds: ScheduleTemplateId[];
  onPick: (id: ScheduleTemplateId) => void;
}) {
  const favorites = SCHEDULE_TEMPLATES.filter(
    (t) => favoriteIds.includes(t.id) && t.id !== "custom"
  );
  if (favorites.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
        <Star className="h-3 w-3" strokeWidth={1.75} fill="currentColor" />
        자주 쓰는 일정
      </p>
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {favorites.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700"
          >
            <ScheduleTemplateIconView
              icon={t.icon}
              className="h-3.5 w-3.5 text-slate-500"
            />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
