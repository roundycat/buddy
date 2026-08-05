"use client";

import Link from "next/link";
import { useState } from "react";
import type { HospitalDayItemDto } from "@/frontend/shared/types/api";
import { cn } from "@/frontend/shared/lib/utils";
import { ScheduleDeliveryEffect } from "@/frontend/features/hospital-day/components/ScheduleDeliveryEffect";
import { ScheduleItemImage } from "@/frontend/features/waiting-room/components/ScheduleNotifySheet";

const typeHint: Record<HospitalDayItemDto["type"], string> = {
  exam: "검사",
  treatment: "치료",
  play: "놀이",
  quiz: "퀴즈",
  story: "동화",
  cheer: "응원",
};

interface HospitalDayViewProps {
  dateLabel: string;
  companionNote: string;
  items: HospitalDayItemDto[];
  parentItemCount?: number;
  freshIds?: string[];
  freshDeliveries?: Array<{
    id: string;
    title: string;
    time?: string;
    type?: string;
    notifyText?: string;
  }>;
}

/**
 * Child hospital day — parent-shared schedules appear with a gentle badge.
 */
export function HospitalDayView({
  dateLabel,
  companionNote,
  items: initialItems,
  parentItemCount = 0,
  freshIds = [],
  freshDeliveries = [],
}: HospitalDayViewProps) {
  const [items, setItems] = useState(initialItems);
  const fresh = new Set(freshIds);
  const parentItems = items.filter((item) => item.source === "parent");
  const otherItems = items.filter((item) => item.source !== "parent");

  async function toggleDone(id: string, done: boolean) {
    const prev = items;
    setItems((list) =>
      list.map((item) => (item.id === id ? { ...item, done } : item))
    );
    try {
      const res = await fetch("/api/hospital-day", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done }),
      });
      if (!res.ok) {
        setItems(prev);
      }
    } catch {
      setItems(prev);
    }
  }

  return (
    <div className="space-y-5">
      <ScheduleDeliveryEffect deliveries={freshDeliveries} />

      <div className="rounded-2xl border border-bedi-slate/8 bg-white/80 px-5 py-4 shadow-softer">
        <p className="text-[11px] tracking-wide text-bedi-sage">{dateLabel}</p>
        <p className="mt-2 text-sm leading-relaxed text-bedi-slate/75">
          {companionNote}
        </p>
        {parentItemCount > 0 ? (
          <p className="mt-2 text-[11px] text-bedi-softBlueDeep/70">
            보호자가 알려 준 일정이 {parentItemCount}개 있어요
          </p>
        ) : null}
      </div>

      {parentItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bedi-slate/15 bg-white/60 px-5 py-8 text-center">
          <p className="text-sm font-medium text-bedi-slate/70">
            아직 도착한 일정이 없어요
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-bedi-slate/45">
            보호자가 검사·치료 일정을 보내면 여기에 모여요.
            <br />
            대기실 알림에서도 바로 확인할 수 있어요.
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
            const isFresh = fresh.has(item.id);
            const what = item.whatText?.trim() || item.explanation;
            const why = item.whyText?.trim();
            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-2xl border border-bedi-softBlue/30 bg-white/90 px-5 py-4 shadow-softer transition-shadow",
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
                {(item.source === "parent" ||
                  item.imageUrl ||
                  item.imageStatus) && (
                  <ScheduleItemImage
                    itemId={item.id}
                    itemTitle={displayTitle}
                    initialUrl={item.imageUrl}
                    initialStatus={item.imageStatus}
                  />
                )}
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
