import { CircleDot, ClipboardList, Pill } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";

export interface TimelineFeedEvent {
  id: string;
  timestamp: string;
  type: "medication" | "challenge" | "note";
  title: string;
  summary: string;
}

export interface TimelineFeedProps {
  events: TimelineFeedEvent[];
}

const typeMeta: Record<
  TimelineFeedEvent["type"],
  { label: string; icon: typeof Pill; accent: string }
> = {
  medication: {
    label: "복약",
    icon: Pill,
    accent: "text-bedi-sage bg-bedi-sage/15",
  },
  challenge: {
    label: "도전",
    icon: ClipboardList,
    accent: "text-bedi-rose bg-bedi-rose/15",
  },
  note: {
    label: "메모",
    icon: CircleDot,
    accent: "text-bedi-slate/60 bg-bedi-slate/8",
  },
};

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function TimelineFeed({ events }: TimelineFeedProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const dateLabel = sorted[0] ? formatDate(sorted[0].timestamp) : "오늘";

  return (
    <section className="rounded-2xl bg-bedi-card p-8 shadow-soft md:p-10">
      <header className="mb-10 border-b border-bedi-slate/8 pb-6">
        <p className="text-xs font-medium tracking-[0.16em] text-bedi-slate/40">
          하루의 흐름
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-bedi-slate">
          시간 순으로 본 오늘
        </h1>
        <p className="mt-2 text-sm text-bedi-slate/50">{dateLabel}</p>
      </header>

      <ol className="relative space-y-0">
        {sorted.map((event, index) => {
          const meta = typeMeta[event.type];
          const Icon = meta.icon;
          const isLast = index === sorted.length - 1;

          return (
            <li
              key={event.id}
              className="relative grid grid-cols-[72px_1fr] gap-4 pb-10 last:pb-0 sm:grid-cols-[96px_1fr]"
            >
              {!isLast && (
                <span
                  className="absolute left-[calc(72px+14px)] top-8 hidden h-[calc(100%-16px)] w-px bg-bedi-slate/10 sm:left-[calc(96px+14px)] sm:block"
                  aria-hidden
                />
              )}
              <time className="pt-1 text-right text-xs font-medium tabular-nums text-bedi-slate/40">
                {formatTime(event.timestamp)}
              </time>
              <div className="relative flex gap-4">
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    meta.accent
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[10px] font-medium tracking-[0.12em] text-bedi-slate/35">
                    {meta.label}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-bedi-slate">
                    {event.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-bedi-slate/55">
                    {event.summary}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
