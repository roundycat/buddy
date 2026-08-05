import type {
  GrowthMomentDto,
  MoodPointDto,
} from "@/frontend/shared/types/api";

const kindHint: Record<GrowthMomentDto["kind"], string> = {
  courage: "용기",
  joy: "즐거움",
  adaptation: "적응",
  mood: "기분",
};

interface GrowthJournalViewProps {
  companionNote: string;
  moodSeries: MoodPointDto[];
  moments: GrowthMomentDto[];
}

export function GrowthJournalView({
  companionNote,
  moodSeries,
  moments,
}: GrowthJournalViewProps) {
  const maxLevel = 5;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-bedi-slate/8 bg-white/80 px-5 py-4 shadow-softer">
        <p className="text-[11px] tracking-wide text-bedi-sage">정서적 성장</p>
        <p className="mt-2 text-sm leading-relaxed text-bedi-slate/75">
          {companionNote}
        </p>
      </div>

      <section className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-5 py-5 shadow-softer">
        <h2 className="text-[15px] font-medium text-bedi-slate">기분 변화</h2>
        <p className="mt-1 text-xs text-bedi-slate/40">최근 며칠의 흐름</p>

        <div className="mt-5 flex h-28 items-end justify-between gap-1.5">
          {moodSeries.map((point) => (
            <div
              key={point.date}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div className="flex h-20 w-full items-end justify-center">
                <div
                  className="w-full max-w-[18px] rounded-t-md bg-bedi-sage/55 transition-[height]"
                  style={{ height: `${(point.level / maxLevel) * 100}%` }}
                  title={`${point.label} (${point.level}/${maxLevel})`}
                />
              </div>
              <span className="text-[9px] tabular-nums text-bedi-slate/40">
                {point.date}
              </span>
            </div>
          ))}
        </div>
      </section>

      <ul className="space-y-3">
        {moments.map((moment) => (
          <li
            key={moment.id}
            className="rounded-2xl border border-bedi-slate/8 bg-white/90 px-5 py-4 shadow-softer"
          >
            <p className="text-[10px] tracking-wide text-bedi-slate/35">
              {kindHint[moment.kind]} · {moment.date}
            </p>
            <h2 className="mt-1 text-[15px] font-medium text-bedi-slate">
              {moment.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-bedi-slate/65">
              {moment.note}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
