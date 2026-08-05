"use client";

import {
  Activity,
  Droplet,
  Magnet,
  Pill,
  Plus,
  Scan,
  Star,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";
import {
  SCHEDULE_TEMPLATES,
  type ScheduleTemplate,
  type ScheduleTemplateIcon,
  type ScheduleTemplateId,
} from "@/frontend/features/parent/lib/schedule-templates";

const ICONS: Record<ScheduleTemplateIcon, LucideIcon> = {
  droplet: Droplet,
  pill: Pill,
  stethoscope: Stethoscope,
  scan: Scan,
  magnet: Magnet,
  activity: Activity,
  syringe: Syringe,
  plus: Plus,
};

export function ScheduleTemplateIconView({
  icon,
  className,
}: {
  icon: ScheduleTemplateIcon;
  className?: string;
}) {
  const Icon = ICONS[icon] ?? Plus;
  return <Icon className={className} strokeWidth={1.75} />;
}

/**
 * Compact preset grid — adult caregiver chrome.
 */
export function ScheduleTemplateSelector({
  selectedId,
  favorites,
  onSelect,
  onToggleFavorite,
}: {
  selectedId: ScheduleTemplateId | null;
  favorites: ScheduleTemplateId[];
  onSelect: (template: ScheduleTemplate) => void;
  onToggleFavorite: (id: ScheduleTemplateId) => void;
}) {
  const favSet = new Set(favorites);
  const ordered = [
    ...SCHEDULE_TEMPLATES.filter((t) => favSet.has(t.id) && t.id !== "custom"),
    ...SCHEDULE_TEMPLATES.filter((t) => !favSet.has(t.id) || t.id === "custom"),
  ];
  const seen = new Set<string>();
  const list = ordered.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  return (
    <div className="grid grid-cols-4 gap-2">
      {list.map((template) => {
        const selected = selectedId === template.id;
        const isFav = favSet.has(template.id) && template.id !== "custom";
        return (
          <div key={template.id} className="relative">
            {template.id !== "custom" ? (
              <button
                type="button"
                aria-label={
                  isFav
                    ? `${template.label} 즐겨찾기 해제`
                    : `${template.label} 즐겨찾기`
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(template.id);
                }}
                className="absolute right-0.5 top-0.5 z-10 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Star
                  className="h-3.5 w-3.5"
                  strokeWidth={1.75}
                  fill={isFav ? "currentColor" : "none"}
                />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onSelect(template)}
              className={cn(
                "flex h-[4.5rem] w-full flex-col items-center justify-center gap-1.5 rounded-lg border px-1 text-center transition-colors",
                selected
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              )}
            >
              <ScheduleTemplateIconView
                icon={template.icon}
                className={cn(
                  "h-4 w-4",
                  selected ? "text-white" : "text-slate-500"
                )}
              />
              <span className="text-[11px] font-medium leading-tight">
                {template.label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
