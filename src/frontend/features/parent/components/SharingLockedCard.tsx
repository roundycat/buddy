import { Lock } from "lucide-react";
import { ParentCard } from "@/frontend/features/parent/components/ParentUi";
import type { ParentShareVisibility } from "@/frontend/features/parent/types";

/**
 * Placeholder for a category the guardian cannot see right now —
 * never shows content or counts.
 */
export function SharingLockedCard({
  title,
  visibility,
  toggleLabel,
}: {
  title: string;
  visibility: Exclude<ParentShareVisibility, "shown">;
  /** Guardian setting name, e.g. 「모험 요약」 */
  toggleLabel: string;
}) {
  const childPrivate = visibility === "child_private";
  return (
    <ParentCard className="border-dashed">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-slate-800">{title}</h3>
        <Lock className="h-4 w-4 text-slate-300" strokeWidth={1.75} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        {childPrivate
          ? "아이가 아직 나누지 않았어요 🔒"
          : `설정에서 「${toggleLabel}」 보기를 켜면 볼 수 있어요.`}
      </p>
      {childPrivate ? (
        <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
          아이가 「보호자와 나누기」에서 직접 정해요. 재촉하지 말고 기다려 주세요.
        </p>
      ) : null}
    </ParentCard>
  );
}
