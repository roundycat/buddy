import type { MemoryEventDto } from "@/frontend/shared/types/api";
import { formatKoreanMonthDay } from "@/frontend/shared/lib/date";
import { SoftEmptyState } from "@/frontend/shared/components/ChildUi";
import { PhotoAlbumSection } from "@/frontend/features/photo-album/components/PhotoAlbumSection";

const typeHint: Record<MemoryEventDto["type"], string> = {
  admission: "입원",
  exam: "검사",
  surgery: "수술",
  rehab: "재활",
  friend: "친구",
  family: "가족",
  mood: "기분",
  adventure: "모험 이야기",
};

interface MemoryTimelineViewProps {
  title: string;
  companionNote: string;
  events: MemoryEventDto[];
}

export function MemoryTimelineView({
  title,
  companionNote,
  events,
}: MemoryTimelineViewProps) {
  return (
    <div className="feature-enter space-y-5">
      <div className="rounded-2xl border border-bedi-slate/8 bg-white/80 px-5 py-4 shadow-softer">
        <p className="text-[11px] tracking-wide text-bedi-sage">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-bedi-slate/75">
          {companionNote}
        </p>
      </div>

      <PhotoAlbumSection />

      {events.length === 0 ? (
        <SoftEmptyState
          icon="🌱"
          title="아직 첫 발자국이에요"
          description="오늘 있었던 일이 하나씩 쌓이면, 여기가 우리만의 긴 이야기가 돼요."
        />
      ) : null}

      <ol className="relative space-y-0 border-l border-bedi-slate/12 ml-3 pl-6">
        {events.map((event) => (
          <li key={event.id} className="relative pb-7 last:pb-0">
            <span
              className="absolute -left-[1.65rem] top-1.5 h-2.5 w-2.5 rounded-full bg-bedi-sage/70 ring-4 ring-[#FBFAF7]"
              aria-hidden
            />
            <p className="text-[10px] tracking-wide text-bedi-slate/35">
              {formatKoreanMonthDay(event.occurredAt)} · {typeHint[event.type]}
            </p>
            <h2 className="mt-1 text-[15px] font-medium text-bedi-slate">
              {event.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-bedi-slate/65">
              {event.summary}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
