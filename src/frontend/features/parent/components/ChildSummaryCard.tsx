import { ParentCard } from "@/frontend/features/parent/components/ParentUi";
import type { ParentChildSummary } from "@/backend/features/parent/parent.types";

export function ChildSummaryCard({ child }: { child: ParentChildSummary }) {
  return (
    <ParentCard>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bedi-mist text-2xl">
          {child.moodEmoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-bedi-slate">
            {child.childName}
          </p>
          <p className="mt-0.5 text-xs text-bedi-slate/45">
            입원 {child.hospitalDay}일째 · {child.moodLabel}
          </p>
          <p className="mt-2 text-sm leading-snug text-bedi-slate/65">
            {child.statusLine}
          </p>
        </div>
      </div>
    </ParentCard>
  );
}
