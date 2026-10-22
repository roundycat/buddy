import { HeartHandshake } from "lucide-react";
import { ParentCard } from "@/frontend/features/parent/components/ParentUi";
import type { ParentConcernNotice } from "@/frontend/features/parent/types";
import { formatKoreanMonthDay } from "@/frontend/shared/lib/date";

/** Concerns the child agreed to share — summary only, never conversation. */
export function ConcernNoticeCard({
  notices,
}: {
  notices: ParentConcernNotice[];
}) {
  if (notices.length === 0) return null;
  return (
    <ParentCard className="border-amber-100 bg-amber-50/60">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-700/70">
          <HeartHandshake className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <ul className="space-y-1.5">
            {notices.map((notice) => (
              <li key={notice.id} className="text-sm leading-relaxed text-slate-700">
                {notice.summary}
                <span className="ml-1.5 text-[11px] tabular-nums text-slate-400">
                  {formatKoreanMonthDay(notice.sharedAt)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
            아이가 직접 “알려도 돼”라고 했어요. 무슨 이야기를 했는지는 공유되지
            않아요. 캐묻기보다 곁에 있어 주세요.
          </p>
        </div>
      </div>
    </ParentCard>
  );
}
