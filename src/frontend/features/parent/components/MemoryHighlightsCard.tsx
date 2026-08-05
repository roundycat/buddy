import { Images } from "lucide-react";
import { ParentCard } from "@/frontend/features/parent/components/ParentUi";
import type { ParentMemoryHighlight } from "@/backend/features/parent/parent.types";

export function MemoryHighlightsCard({
  memories,
}: {
  memories: ParentMemoryHighlight[];
}) {
  return (
    <ParentCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-slate-800">최근 기억</h3>
        <Images className="h-4 w-4 text-slate-300" strokeWidth={1.75} />
      </div>

      {memories.length === 0 ? (
        <p className="text-sm text-slate-400">아직 하이라이트가 없습니다</p>
      ) : (
        <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
          {memories.map((m) => (
            <div
              key={m.id}
              className="flex h-32 w-32 shrink-0 flex-col justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
            >
              <p className="text-[11px] font-medium text-slate-400">{m.title}</p>
              <p className="line-clamp-3 text-sm font-medium leading-snug text-slate-700">
                {m.caption}
              </p>
            </div>
          ))}
        </div>
      )}
    </ParentCard>
  );
}
