"use client";

import { motion } from "framer-motion";
import { cn } from "@/frontend/shared/lib/utils";
import { GrowingFlower } from "@/frontend/features/emotion-garden/components/GrowingFlower";
import type { GardenPlantView } from "@/frontend/shared/catalogs";

interface WeekGardenProps {
  todayDate: string; // YYYY-MM-DD
  flowers: GardenPlantView[];
  onOpenMemory: (plant: GardenPlantView) => void;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** Parse YYYY-MM-DD as a local date so day labels never shift a day. */
function parseLocalDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Last seven days at a glance — one soil spot per day.
 * A quiet record of the week, not a streak or a score.
 */
export function WeekGarden({
  todayDate,
  flowers,
  onOpenMemory,
}: WeekGardenProps) {
  const today = parseLocalDate(todayDate);
  const byDate = new Map(flowers.map((f) => [f.plantedOn, f] as const));

  const days = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - i));
    const key = toKey(date);
    return {
      key,
      weekday: WEEKDAY[date.getDay()],
      dayNum: date.getDate(),
      isToday: key === todayDate,
      plant: byDate.get(key) ?? null,
    };
  });

  const bloomedThisWeek = days.filter(
    (d) => d.plant?.stage === "bloom"
  ).length;
  const plantedThisWeek = days.filter((d) => d.plant).length;

  return (
    <section className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-4 py-4 shadow-softer">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-[15px] font-medium text-bedi-slate">이번 주 정원</h2>
          <p className="mt-1 text-xs leading-relaxed text-bedi-slate/40">
            {plantedThisWeek === 0
              ? "아직 비어 있어요. 오늘 마음 하나를 심으면 여기 첫 싹이 나요."
              : `씨앗 ${plantedThisWeek} · 활짝 핀 꽃 ${bloomedThisWeek}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const interactive = Boolean(day.plant);
          const Wrapper = interactive ? motion.button : "div";

          return (
            <Wrapper
              key={day.key}
              {...(interactive
                ? {
                    type: "button" as const,
                    whileTap: { scale: 0.94 },
                    onClick: () => day.plant && onOpenMemory(day.plant),
                    "aria-label": `${day.dayNum}일 ${day.plant!.flowerName} 기억 보기`,
                  }
                : { "aria-hidden": true })}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl px-0.5 py-2 transition-colors",
                day.isToday && "bg-bedi-sage/10 ring-1 ring-bedi-sage/25",
                interactive && !day.isToday && "hover:bg-bedi-slate/[0.03]"
              )}
            >
              <span
                className={cn(
                  "text-[9px]",
                  day.isToday
                    ? "font-medium text-bedi-sage"
                    : "text-bedi-slate/35"
                )}
              >
                {day.weekday}
              </span>

              <div className="flex h-12 items-end justify-center">
                {day.plant ? (
                  <GrowingFlower
                    mood={day.plant.mood}
                    stage={day.plant.stage}
                    size="sm"
                    sway={day.plant.stage === "bloom"}
                    showSoil={false}
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                ) : (
                  <span
                    className="mb-1 h-1.5 w-5 rounded-full bg-bedi-slate/10"
                    aria-hidden
                  />
                )}
              </div>

              <span
                className={cn(
                  "text-[9px] tabular-nums",
                  day.isToday ? "text-bedi-sage" : "text-bedi-slate/30"
                )}
              >
                {day.dayNum}
              </span>
            </Wrapper>
          );
        })}
      </div>

      {plantedThisWeek > 0 ? (
        <p className="mt-3 text-center text-[11px] text-bedi-slate/40">
          꽃을 누르면 그날의 기억이 열려요
        </p>
      ) : null}
    </section>
  );
}
