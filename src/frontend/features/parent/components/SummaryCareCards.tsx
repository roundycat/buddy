import { Lightbulb, Sparkles } from "lucide-react";
import type { ParentCareSuggestion } from "@/frontend/shared/types/parent";

export function DailySummaryCard({ summary }: { summary: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="text-[12px] font-medium">AI 요약</span>
      </div>
      <p className="text-[14px] leading-relaxed text-slate-700">{summary}</p>
      <p className="text-[11px] text-slate-400">대화 원문은 포함되지 않습니다</p>
    </section>
  );
}

export function CareSuggestionCard({
  suggestions,
}: {
  suggestions: ParentCareSuggestion[];
}) {
  const tip = suggestions[0];
  const quote = suggestions[1];

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="text-[12px] font-medium">돌봄 참고</span>
      </div>
      {tip ? (
        <p className="text-[14px] font-medium leading-relaxed text-slate-800">
          {tip.text}
        </p>
      ) : (
        <p className="text-sm text-slate-400">오늘은 조용히 곁에 있어 주세요.</p>
      )}
      {quote ? (
        <div className="mt-1 rounded-lg bg-slate-50 p-3">
          <p className="text-[13px] leading-relaxed text-slate-600">
            {quote.text}
          </p>
        </div>
      ) : null}
      <p className="text-[11px] text-slate-400">
        치료 조언이 아닙니다 · 곁을 위한 참고만
      </p>
    </section>
  );
}
