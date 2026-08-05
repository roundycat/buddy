import type { ParentTodayMessage } from "@/backend/features/parent/parent.types";

export function TodaysMessageCard({
  message,
}: {
  message: ParentTodayMessage;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[15px] leading-relaxed text-slate-700">
        {message.text}
      </p>
      <p className="mt-3 text-[11px] text-slate-400">{message.generatedAtLabel}</p>
    </section>
  );
}
