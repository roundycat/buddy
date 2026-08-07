"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Rows3 } from "lucide-react";
import type { HospitalDayItemDto } from "@/frontend/shared/types/api";
import { cn } from "@/frontend/shared/lib/utils";
import { ScheduleDeliveryEffect } from "@/frontend/features/hospital-day/components/ScheduleDeliveryEffect";
import { ScheduleItemImage } from "@/frontend/features/waiting-room/components/ScheduleNotifySheet";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const typeHint: Record<HospitalDayItemDto["type"], string> = {
  exam: "검사",
  treatment: "치료",
  play: "놀이",
  quiz: "퀴즈",
  story: "동화",
  cheer: "응원",
};

export interface HospitalCalendarDayDto {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  hasContent: boolean;
  examCount: number;
  treatmentCount: number;
  icon: string;
}

export interface HospitalScheduleMonthDto {
  monthKey: string;
  monthLabel: string;
  calendarDays: HospitalCalendarDayDto[];
  datesWithSchedules: string[];
}

export interface HospitalDayPayload {
  dateLabel: string;
  companionNote: string;
  items: HospitalDayItemDto[];
  parentItemCount: number;
  dateKey?: string;
  freshDeliveries?: Array<{
    id: string;
    title: string;
    time?: string;
    type?: string;
    notifyText?: string;
  }>;
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y!, m! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftDate(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(y!, m! - 1, d! + delta);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function todayLocalKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function buildStripKeys(center: string, month: HospitalScheduleMonthDto): string[] {
  const set = new Set<string>();
  for (let i = -7; i <= 14; i++) set.add(shiftDate(center, i));
  for (const d of month.datesWithSchedules) set.add(d);
  for (const cell of month.calendarDays) {
    if (cell.inMonth) set.add(cell.dateKey);
  }
  return Array.from(set).sort();
}

/**
 * Child schedule browser — calendar or horizontal day strip + day detail.
 */
export function HospitalScheduleView({
  initialDay,
  initialMonth,
}: {
  initialDay: HospitalDayPayload;
  initialMonth: HospitalScheduleMonthDto;
}) {
  const today = todayLocalKey();
  const [mode, setMode] = useState<"calendar" | "strip">("calendar");
  const [month, setMonth] = useState(initialMonth);
  const [selectedKey, setSelectedKey] = useState(
    initialDay.dateKey || today
  );
  const [day, setDay] = useState(initialDay);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const items = day.items ?? [];
  const parentItems = items.filter((item) => item.source === "parent");
  const otherItems = items.filter((item) => item.source !== "parent");
  const freshIds = new Set((day.freshDeliveries ?? []).map((d) => d.id));

  const stripKeys = useMemo(
    () => buildStripKeys(selectedKey, month),
    [selectedKey, month]
  );

  const contentByDate = useMemo(() => {
    const map = new Map<string, HospitalCalendarDayDto>();
    for (const cell of month.calendarDays) map.set(cell.dateKey, cell);
    return map;
  }, [month.calendarDays]);

  useEffect(() => {
    if (mode !== "strip") return;
    const el = stripRef.current?.querySelector<HTMLElement>(
      `[data-date="${selectedKey}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [mode, selectedKey, stripKeys]);

  async function loadMonth(nextKey: string) {
    setLoadingMonth(true);
    try {
      const res = await fetch(
        `/api/hospital-day?month=${encodeURIComponent(nextKey)}`
      );
      if (!res.ok) return;
      const next = (await res.json()) as HospitalScheduleMonthDto;
      setMonth(next);
      const prefer =
        next.calendarDays.find((d) => d.isToday && d.inMonth)?.dateKey ??
        next.datesWithSchedules[0] ??
        next.calendarDays.find((d) => d.inMonth)?.dateKey;
      if (prefer) await selectDate(prefer, next.monthKey);
    } finally {
      setLoadingMonth(false);
    }
  }

  async function selectDate(dateKey: string, monthHint?: string) {
    if (dateKey === selectedKey && day.dateKey === dateKey) {
      setSelectedKey(dateKey);
      return;
    }
    setSelectedKey(dateKey);
    setLoadingDay(true);
    try {
      const res = await fetch(
        `/api/hospital-day?date=${encodeURIComponent(dateKey)}`
      );
      if (!res.ok) return;
      const next = (await res.json()) as HospitalDayPayload;
      setDay(next);
      const mk = monthHint ?? dateKey.slice(0, 7);
      if (mk !== month.monthKey) {
        const mRes = await fetch(
          `/api/hospital-day?month=${encodeURIComponent(mk)}`
        );
        if (mRes.ok) {
          setMonth((await mRes.json()) as HospitalScheduleMonthDto);
        }
      }
    } finally {
      setLoadingDay(false);
    }
  }

  async function toggleDone(id: string, done: boolean) {
    const prev = day;
    setDay((cur) => ({
      ...cur,
      items: cur.items.map((item) =>
        item.id === id ? { ...item, done } : item
      ),
    }));
    try {
      const res = await fetch("/api/hospital-day", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done }),
      });
      if (!res.ok) setDay(prev);
    } catch {
      setDay(prev);
    }
  }

  return (
    <div className="space-y-5">
      <ScheduleDeliveryEffect deliveries={day.freshDeliveries ?? []} />

      <div className="flex rounded-xl bg-bedi-mist/70 p-1">
        <button
          type="button"
          onClick={() => setMode("calendar")}
          className={cn(
            "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm transition-colors",
            mode === "calendar"
              ? "bg-white font-medium text-bedi-slate shadow-softer"
              : "text-bedi-slate/45"
          )}
        >
          <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
          달력
        </button>
        <button
          type="button"
          onClick={() => setMode("strip")}
          className={cn(
            "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm transition-colors",
            mode === "strip"
              ? "bg-white font-medium text-bedi-slate shadow-softer"
              : "text-bedi-slate/45"
          )}
        >
          <Rows3 className="h-4 w-4" strokeWidth={1.75} />
          날짜 스크롤
        </button>
      </div>

      {mode === "calendar" ? (
        <div className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-4 py-4 shadow-softer">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              disabled={loadingMonth}
              aria-label="이전 달"
              onClick={() => void loadMonth(shiftMonth(month.monthKey, -1))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-bedi-mist text-bedi-softBlueDeep transition-transform duration-150 active:scale-95 disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-[15px] font-semibold text-bedi-slate">
              {month.monthLabel}
            </p>
            <button
              type="button"
              disabled={loadingMonth}
              aria-label="다음 달"
              onClick={() => void loadMonth(shiftMonth(month.monthKey, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-bedi-mist text-bedi-softBlueDeep transition-transform duration-150 active:scale-95 disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="py-1 text-center text-[11px] font-medium text-bedi-slate/40"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {month.calendarDays.map((cell) => (
              <button
                key={`${cell.dateKey}-${cell.inMonth ? "in" : "out"}`}
                type="button"
                disabled={!cell.inMonth || loadingDay}
                onClick={() => void selectDate(cell.dateKey)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-xl text-[11px] transition-colors",
                  !cell.inMonth && "opacity-25",
                  cell.inMonth && "hover:bg-bedi-mist/80",
                  cell.isToday && "ring-2 ring-bedi-softBlue/40",
                  selectedKey === cell.dateKey &&
                    cell.inMonth &&
                    "bg-bedi-mist text-bedi-softBlueDeep",
                  cell.hasContent && cell.inMonth && "font-semibold"
                )}
              >
                <span className="tabular-nums text-bedi-slate/55">
                  {cell.day}
                </span>
                <span className="mt-0.5 text-sm leading-none" aria-hidden>
                  {cell.inMonth ? cell.icon : ""}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-bedi-slate/45">
            <span>🩺 검사</span>
            <span>💉 치료</span>
            <span>· 일정 없음</span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-3 py-3 shadow-softer">
          <div
            ref={stripRef}
            className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {stripKeys.map((key) => {
              const cell = contentByDate.get(key);
              const [, , dd] = key.split("-");
              const dayNum = Number(dd);
              const isSelected = key === selectedKey;
              const isToday = key === today;
              const hasContent =
                cell?.hasContent || month.datesWithSchedules.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  data-date={key}
                  disabled={loadingDay}
                  onClick={() => void selectDate(key)}
                  className={cn(
                    "flex w-14 shrink-0 flex-col items-center rounded-2xl px-2 py-2.5 transition-colors",
                    isSelected
                      ? "bg-bedi-softBlueDeep text-white"
                      : "bg-bedi-mist/60 text-bedi-slate/70 hover:bg-bedi-mist",
                    isToday && !isSelected && "ring-2 ring-bedi-softBlue/35"
                  )}
                >
                  <span className="text-[10px] opacity-70">
                    {WEEKDAYS[new Date(key + "T12:00:00").getDay()] ?? ""}
                  </span>
                  <span className="mt-0.5 text-base font-semibold tabular-nums">
                    {dayNum}
                  </span>
                  <span
                    className={cn(
                      "mt-1 h-1.5 w-1.5 rounded-full",
                      hasContent
                        ? isSelected
                          ? "bg-white"
                          : "bg-bedi-softBlueDeep"
                        : "bg-transparent"
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-bedi-slate/8 bg-white/80 px-5 py-4 shadow-softer">
        <p className="text-[11px] tracking-wide text-bedi-sage">
          {day.dateLabel}
          {selectedKey === today ? "" : ` · ${selectedKey}`}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-bedi-slate/75">
          {loadingDay ? "일정을 불러오는 중…" : day.companionNote}
        </p>
        {day.parentItemCount > 0 ? (
          <p className="mt-2 text-[11px] text-bedi-softBlueDeep/70">
            보호자가 알려 준 일정이 {day.parentItemCount}개 있어요
          </p>
        ) : null}
      </div>

      {parentItems.length === 0 && !loadingDay ? (
        <div className="rounded-2xl border border-dashed border-bedi-slate/15 bg-white/60 px-5 py-8 text-center">
          <p className="text-sm font-medium text-bedi-slate/70">
            이 날 일정이 없어요
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-bedi-slate/45">
            달력에서 다른 날을 고르거나, 보호자가 보낸 일정을 기다려 보세요.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-bedi-softBlueDeep px-4 text-sm font-medium text-white"
          >
            대기실로 돌아가기
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {parentItems.map((item) => {
            const displayTitle = item.childTitle || item.title;
            const isFresh = freshIds.has(item.id);
            const what = item.whatText?.trim() || item.explanation;
            const why = item.whyText?.trim();
            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-2xl border border-bedi-softBlue/30 bg-white/90 px-5 py-4 shadow-softer",
                  isFresh && "bedi-fresh-schedule border-bedi-softBlue/50",
                  item.done && "opacity-70"
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-[10px] tracking-wide text-bedi-slate/35">
                      {typeHint[item.type] ?? "일정"}
                      {" · 보호자가 알려 줌"}
                      {isFresh ? " · 방금 도착" : ""}
                    </p>
                    <h2 className="mt-1 text-[15px] font-medium text-bedi-slate">
                      {displayTitle}
                    </h2>
                  </div>
                  {item.time ? (
                    <span className="shrink-0 rounded-full bg-bedi-mist px-2.5 py-1 tabular-nums text-xs font-medium text-bedi-softBlueDeep">
                      {item.time}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-bedi-slate/65">
                  {what}
                </p>
                {why && why !== what ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-bedi-slate/55">
                    {why}
                  </p>
                ) : null}
                <ScheduleItemImage
                  itemId={item.id}
                  itemTitle={displayTitle}
                  initialUrl={item.imageUrl}
                  initialStatus={item.imageStatus}
                />
                <button
                  type="button"
                  onClick={() => void toggleDone(item.id, !item.done)}
                  className="mt-3 h-10 w-full rounded-xl border border-bedi-slate/10 text-xs text-bedi-slate/60"
                >
                  {item.done ? "다시 예정으로" : "이 일정 끝냈어요"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {otherItems.length > 0 ? (
        <ul className="space-y-3">
          {otherItems.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-5 py-4 shadow-softer"
            >
              <p className="text-[10px] tracking-wide text-bedi-slate/35">
                {typeHint[item.type] ?? "안내"}
              </p>
              <h2 className="mt-1 text-[15px] font-medium text-bedi-slate">
                {item.childTitle || item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-bedi-slate/65">
                {item.explanation}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
