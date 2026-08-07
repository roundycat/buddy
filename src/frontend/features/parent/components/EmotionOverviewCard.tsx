import { Activity } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";
import { ParentCard } from "@/frontend/features/parent/components/ParentUi";
import type {
  ParentEmotionOverview,
  ParentMoodTone,
} from "@/frontend/shared/types/parent";

const toneFill: Record<ParentMoodTone, string> = {
  warm: "#E8B86D",
  calm: "#6BA3C4",
  tired: "#D4929A",
  brave: "#7AAB8C",
  mixed: "#A8B0B8",
};

/**
 * Weekly emotion trend — calm chart for adult caregivers.
 */
export function EmotionOverviewCard({
  emotion,
}: {
  emotion: ParentEmotionOverview;
}) {
  const points = emotion.weekly;
  const recorded = points.filter((p) => !p.empty && p.score > 0);
  const w = 320;
  const h = 120;
  const padX = 18;
  const padY = 16;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? padX + chartW / 2
        : padX + (i / (points.length - 1)) * chartW;
    const score = p.empty ? 12 : Math.max(8, p.score);
    const y = padY + chartH - (score / 100) * chartH;
    return { x, y, p };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    coords.length > 0
      ? [
          `M ${coords[0]!.x.toFixed(1)} ${(padY + chartH).toFixed(1)}`,
          ...coords.map((c) => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`),
          `L ${coords[coords.length - 1]!.x.toFixed(1)} ${(padY + chartH).toFixed(1)}`,
          "Z",
        ].join(" ")
      : "";

  const chips =
    emotion.distribution.length > 0
      ? emotion.distribution
      : [
          {
            label: emotion.dominantLabel,
            emoji: emotion.dominantEmoji,
            percent: recorded.length ? 100 : 0,
          },
        ];

  return (
    <ParentCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-800">
            감정 흐름
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-400">최근 7일</p>
        </div>
        <Activity className="h-4 w-4 text-slate-300" strokeWidth={1.75} />
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <div
            key={chip.label}
            className="rounded-md bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-600"
          >
            {chip.label}
            {chip.percent > 0 ? (
              <span className="ml-1 tabular-nums text-slate-400">
                {chip.percent}%
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-slate-50 px-2 pb-2 pt-3">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-28 w-full"
          role="img"
          aria-label="최근 7일 감정 흐름 그래프"
        >
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={padX}
              x2={w - padX}
              y1={padY + chartH * (1 - t)}
              y2={padY + chartH * (1 - t)}
              stroke="rgba(15,23,42,0.06)"
              strokeWidth="1"
            />
          ))}

          {areaPath ? (
            <path d={areaPath} fill="rgba(107,163,196,0.16)" />
          ) : null}

          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke="#5A8FB0"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {coords.map(({ x, y, p }, i) => {
            const barW = Math.min(20, chartW / points.length - 6);
            const barH = p.empty
              ? chartH * 0.12
              : (Math.max(8, p.score) / 100) * chartH;
            const barY = padY + chartH - barH;
            return (
              <g key={`${p.dayLabel}-${i}`}>
                <rect
                  x={x - barW / 2}
                  y={barY}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={p.empty ? "rgba(148,163,184,0.35)" : toneFill[p.tone]}
                  opacity={p.empty ? 0.7 : 0.9}
                />
                {!p.empty ? (
                  <circle
                    cx={x}
                    cy={y}
                    r={3.5}
                    fill="#fff"
                    stroke={toneFill[p.tone]}
                    strokeWidth="2"
                  />
                ) : null}
              </g>
            );
          })}
        </svg>

        <div className="mt-1 flex justify-between px-1">
          {points.map((p, i) => (
            <div
              key={`${p.dayLabel}-${i}`}
              className="flex flex-1 flex-col items-center gap-0.5"
              title={p.empty ? "기록 전" : p.label}
            >
              <span className="text-[10px] tabular-nums text-slate-400">
                {p.dayLabel}
              </span>
              <span
                className={cn(
                  "text-[10px]",
                  p.empty ? "text-slate-300" : "text-slate-500"
                )}
              >
                {p.empty ? "—" : p.label.slice(0, 2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {recorded.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-slate-400">
          아이가 감정 정원을 쓰면 여기에 일주일 흐름이 표시됩니다.
        </p>
      ) : (
        <p className="text-[12px] leading-relaxed text-slate-400">
          오늘 경향 · {emotion.dominantLabel}. 의료 진단이 아닌 참고용
          요약입니다.
        </p>
      )}
    </ParentCard>
  );
}

export function EmotionTrendHiddenCard() {
  return (
    <ParentCard className="border-dashed">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-slate-800">감정 흐름</h3>
        <Activity className="h-4 w-4 text-slate-300" strokeWidth={1.75} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        설정에서 「감정 트렌드」 공유를 켜면 최근 7일 그래프를 볼 수 있습니다.
      </p>
    </ParentCard>
  );
}
