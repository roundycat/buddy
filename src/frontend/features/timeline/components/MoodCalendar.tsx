"use client";

import { useMemo, useState } from "react";
import {
  CloudRain,
  Coffee,
  Heart,
  Pill,
  StickyNote,
  Sun,
  Wind,
} from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";
import { TopBrandBar } from "@/frontend/shared/components/TopBrandBar";

export type DoodleKind =
  | "sun"
  | "rain"
  | "coffee"
  | "pill"
  | "note"
  | "heart"
  | "wind";

export interface CalendarDoodle {
  day: number;
  kind: DoodleKind;
  label: string;
}

const DOODLE_ICON: Record<DoodleKind, typeof Sun> = {
  sun: Sun,
  rain: CloudRain,
  coffee: Coffee,
  pill: Pill,
  note: StickyNote,
  heart: Heart,
  wind: Wind,
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** Mock doodles for August 2026 — Sumlog-style visual journal */
const MOCK_DOODLES: CalendarDoodle[] = [
  { day: 1, kind: "sun", label: "맑은 아침" },
  { day: 2, kind: "pill", label: "복약" },
  { day: 3, kind: "note", label: "짧은 메모" },
  { day: 4, kind: "coffee", label: "따뜻한 차" },
  { day: 5, kind: "rain", label: "가라앉은 날" },
  { day: 7, kind: "heart", label: "체크인" },
  { day: 8, kind: "wind", label: "숨 고르기" },
  { day: 9, kind: "pill", label: "복약" },
  { day: 10, kind: "sun", label: "괜찮은 하루" },
  { day: 11, kind: "note", label: "생각 정리" },
  { day: 12, kind: "coffee", label: "오후의 여유" },
  { day: 14, kind: "heart", label: "대화" },
  { day: 15, kind: "pill", label: "복약" },
  { day: 16, kind: "rain", label: "조용한 날" },
  { day: 18, kind: "sun", label: "햇살" },
  { day: 20, kind: "wind", label: "스트레칭" },
  { day: 22, kind: "note", label: "기록" },
  { day: 24, kind: "pill", label: "복약" },
  { day: 25, kind: "heart", label: "체크인" },
  { day: 28, kind: "coffee", label: "따뜻한 순간" },
  { day: 30, kind: "sun", label: "마무리" },
];

export function MoodCalendar({
  year = 2026,
  month = 8,
  doodles = MOCK_DOODLES,
  today = 4,
}: {
  year?: number;
  month?: number;
  doodles?: CalendarDoodle[];
  today?: number;
}) {
  const [selected, setSelected] = useState<CalendarDoodle | null>(
    () => doodles.find((d) => d.day === today) ?? null
  );

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const doodleMap = new Map(doodles.map((d) => [d.day, d]));

    const result: Array<{ day: number | null; doodle?: CalendarDoodle }> = [];
    for (let i = 0; i < startWeekday; i++) result.push({ day: null });
    for (let day = 1; day <= daysInMonth; day++) {
      result.push({ day, doodle: doodleMap.get(day) });
    }
    return result;
  }, [year, month, doodles]);

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
  })
    .format(new Date(year, month - 1, 1))
    .toUpperCase();

  return (
    <section className="paper-room mx-auto min-h-[calc(100vh-4rem)] max-w-lg px-5 pb-8 pt-2">
      <TopBrandBar />

      <div className="mt-6 text-center">
        <p className="font-display text-2xl font-semibold tracking-tight text-bedi-slate">
          Beddylog
        </p>
        <p className="mt-6 text-xs tracking-[0.28em] text-bedi-slate/45">
          {month} {monthLabel}
        </p>
      </div>

      <div className="mt-8">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="py-1 text-center text-[10px] text-bedi-slate/35"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-3 gap-x-1">
          {cells.map((cell, index) => {
            if (!cell.day) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const isToday = cell.day === today;
            const Icon = cell.doodle ? DOODLE_ICON[cell.doodle.kind] : null;

            return (
              <button
                key={cell.day}
                type="button"
                onClick={() => cell.doodle && setSelected(cell.doodle)}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-full transition-colors",
                  isToday && "ring-1 ring-bedi-rose/70 ring-offset-2 ring-offset-[#FBFAF7]",
                  cell.doodle ? "hover:bg-bedi-sage/10" : "text-bedi-slate/25"
                )}
              >
                {Icon ? (
                  <Icon
                    className="h-4 w-4 text-bedi-slate/55"
                    strokeWidth={1.4}
                  />
                ) : (
                  <span className="text-[11px] tabular-nums text-bedi-slate/30">
                    {cell.day}
                  </span>
                )}
                {cell.doodle && (
                  <span className="mt-0.5 text-[8px] tabular-nums text-bedi-slate/30">
                    {cell.doodle.day}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="mt-10 rounded-2xl border border-bedi-slate/8 bg-white/70 px-5 py-4 shadow-softer">
          <p className="text-xs text-bedi-slate/40">
            {month}월 {selected.day}일
          </p>
          <p className="mt-1 text-sm font-medium text-bedi-slate">
            {selected.label}
          </p>
        </div>
      )}
    </section>
  );
}
