"use client";

import { Heart, MessageSquare } from "lucide-react";
import type { ParentEmpathyGuide } from "@/frontend/shared/types/parent";
import { ParentCard } from "@/frontend/features/parent/components/ParentUi";

/**
 * Empathy guide — adult slate system, calm coaching tone.
 */
export function TodaysEmpathyGuideCard({
  guide,
}: {
  guide: ParentEmpathyGuide;
}) {
  return (
    <ParentCard className="space-y-4" aria-label="오늘의 공감 가이드">
      <div>
        <div className="flex items-center gap-1.5 text-slate-500">
          <Heart className="h-3.5 w-3.5" strokeWidth={1.75} />
          <p className="text-[12px] font-medium">오늘의 공감 가이드</p>
        </div>
        <p className="mt-2 text-[15px] font-semibold leading-snug text-slate-800">
          {guide.emotionalSummary}
        </p>
        {guide.sources.length > 0 ? (
          <p className="mt-1.5 text-[11px] text-slate-400">
            참고 · {guide.sources.join(" · ")}
          </p>
        ) : null}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-slate-500">
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
          <p className="text-[12px] font-medium">대화 제안</p>
        </div>
        <div className="space-y-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] text-slate-400">피하면 좋은 말</p>
            <p className="mt-0.5 text-[13px] text-slate-500 line-through decoration-slate-300">
              “{guide.empathyCoaching.avoidSaying}”
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">대신</p>
            <p className="mt-0.5 text-[14px] font-semibold leading-snug text-slate-800">
              “{guide.empathyCoaching.trySaying}”
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
              {guide.empathyCoaching.why}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-slate-500">
          함께하면 좋은 일
        </p>
        <ul className="space-y-1">
          {guide.thingsToDo.map((item) => (
            <li
              key={item}
              className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] leading-snug text-slate-700"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-slate-500">
          오늘은 천천히
        </p>
        <ul className="space-y-1">
          {guide.thingsToAvoid.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-slate-100 px-3 py-2.5 text-[13px] leading-snug text-slate-600"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg bg-slate-800 px-4 py-3.5">
        <p className="text-[11px] font-medium text-slate-400">보호자님께</p>
        <p className="mt-1 text-[14px] leading-relaxed text-white">
          {guide.encouragingMessage}
        </p>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-400">
        의료 진단·처방이 아닙니다. 일상 대화 참고용입니다.
      </p>
    </ParentCard>
  );
}
