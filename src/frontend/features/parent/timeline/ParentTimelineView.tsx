"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ParentShell } from "@/frontend/features/parent/components/ParentShell";
import {
  EmptyState,
  ParentCard,
} from "@/frontend/features/parent/components/ParentUi";
import { cn } from "@/frontend/shared/lib/utils";
import type {
  ParentTimelineEntry,
  ParentTimelineResponse,
} from "@/frontend/features/parent/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y!, m! - 1 + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

/**
 * Month calendar of care days — treatment / exam / adventure icons.
 */
export function ParentTimelineView({ data }: { data: ParentTimelineResponse }) {
  const [monthKey, setMonthKey] = useState(data.monthKey);
  const [payload, setPayload] = useState(data);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    const today = payload.calendarDays.find((d) => d.isToday && d.inMonth);
    const withContent = payload.entries[0]?.dateKey;
    return today?.dateKey ?? withContent ?? null;
  });

  const entryByDay = useMemo(() => {
    const map = new Map<string, ParentTimelineEntry>();
    for (const e of payload.entries) map.set(e.dateKey, e);
    return map;
  }, [payload.entries]);

  const selected = selectedKey ? entryByDay.get(selectedKey) : null;
  const selectedCell = payload.calendarDays.find(
    (d) => d.dateKey === selectedKey
  );

  async function loadMonth(nextKey: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/parent/timeline?month=${encodeURIComponent(nextKey)}`
      );
      const next = (await res.json()) as ParentTimelineResponse;
      if (!res.ok) return;
      setMonthKey(next.monthKey);
      setPayload(next);
      const first =
        next.calendarDays.find((d) => d.isToday && d.inMonth)?.dateKey ??
        next.entries[0]?.dateKey ??
        next.calendarDays.find((d) => d.inMonth)?.dateKey ??
        null;
      setSelectedKey(first);
    } finally {
      setLoading(false);
    }
  }

  if (!payload.linked) {
    return (
      <ParentShell>
        <EmptyState
          title="연결된 아이가 없어요"
          description="홈에서 초대 코드로 연결하면 여정이 열려요."
        />
      </ParentShell>
    );
  }

  return (
    <ParentShell childName={payload.childName} moodEmoji="📅" hideContext>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-800">일정 기록</h1>
        <p className="mt-2 text-sm text-slate-400">
          치료·검사·활동 기록을 한눈에 확인합니다
        </p>
      </div>

      <ParentCard className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            disabled={loading}
            aria-label="이전 달"
            onClick={() => void loadMonth(shiftMonth(monthKey, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-[16px] font-semibold text-slate-800">
            {payload.monthLabel}
          </p>
          <button
            type="button"
            disabled={loading}
            aria-label="다음 달"
            onClick={() => void loadMonth(shiftMonth(monthKey, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="py-1 text-center text-[11px] font-medium text-slate-400"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {payload.calendarDays.map((cell) => (
            <button
              key={`${cell.dateKey}-${cell.inMonth ? "in" : "out"}`}
              type="button"
              disabled={!cell.inMonth}
              onClick={() => setSelectedKey(cell.dateKey)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-xl text-[11px] transition-colors",
                !cell.inMonth && "opacity-25",
                cell.inMonth && "hover:bg-slate-100",
                cell.isToday && "ring-2 ring-slate-400",
                selectedKey === cell.dateKey &&
                  cell.inMonth &&
                  "bg-slate-100 text-slate-700",
                cell.hasContent && cell.inMonth && "font-semibold"
              )}
            >
              <span className="tabular-nums text-slate-500">{cell.day}</span>
              <span className="mt-0.5 text-base leading-none" aria-hidden>
                {cell.inMonth ? cell.icon : ""}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-400">
          <span>💉 치료</span>
          <span>🩺 검사</span>
          <span>⭐ 모험</span>
          <span>🌱 감정</span>
          <span>· 조용한 날</span>
        </div>
      </ParentCard>

      {selectedCell?.inMonth ? (
        <ParentCard className="border-slate-200">
          <p className="text-[11px] tracking-wide text-slate-500">
            {selectedCell.dateKey}
            {selectedCell.isToday ? " · 오늘" : ""}
          </p>
          {selected ? (
            <>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-800">
                  {selected.headline}
                </h2>
                <span className="shrink-0 text-sm">
                  {selected.moodEmoji} {selected.moodLabel}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-800/65">
                {selected.reflection}
              </p>

              {selected.schedules.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {selected.schedules.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
                    >
                      <span aria-hidden>
                        {s.type === "exam" ? "🩺" : "💉"}
                      </span>
                      <span className="min-w-0 flex-1">
                        {s.type === "exam" ? "검사" : "치료"} · {s.title}
                        {s.time ? ` (${s.time})` : ""}
                      </span>
                      <span
                        className={cn(
                          "text-[10px]",
                          s.done
                            ? "text-slate-400"
                            : "text-slate-700"
                        )}
                      >
                        {s.done ? "완료" : "예정"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {selected.adventures.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selected.adventures.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500"
                    >
                      ⭐ {a}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-3 text-center">
              <p className="text-3xl" aria-hidden>
                🌱
              </p>
              <p className="mt-2 text-sm text-slate-800/50">
                이 날은 특별한 기록이 없어요. 쉬는 날도 소중한 하루예요.
              </p>
            </div>
          )}
        </ParentCard>
      ) : null}
    </ParentShell>
  );
}
