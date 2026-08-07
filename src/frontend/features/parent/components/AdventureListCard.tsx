import { Check, ListChecks } from "lucide-react";
import { ParentCard } from "@/frontend/features/parent/components/ParentUi";
import { cn } from "@/frontend/shared/lib/utils";
import type { ParentAdventureItem } from "@/frontend/shared/types/parent";

export function AdventureListCard({
  adventures,
}: {
  adventures: ParentAdventureItem[];
}) {
  const done = adventures.filter((a) => a.completed).length;

  return (
    <ParentCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-800">
            오늘의 활동
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-400">
            {adventures.length === 0
              ? "등록된 활동 없음"
              : `${done}/${adventures.length} 완료`}
          </p>
        </div>
        <ListChecks className="h-4 w-4 text-slate-300" strokeWidth={1.75} />
      </div>

      <ul className="flex flex-col gap-1.5">
        {adventures.length === 0 ? (
          <li className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-400">
            아직 활동이 없습니다
          </li>
        ) : (
          adventures.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5",
                item.completed ? "bg-slate-50" : "bg-white"
              )}
            >
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  item.completed
                    ? "bg-slate-700 text-white"
                    : "border border-slate-300"
                )}
              >
                {item.completed ? (
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                ) : null}
              </div>
              <span
                className={cn(
                  "text-sm",
                  item.completed
                    ? "text-slate-700"
                    : "text-slate-500"
                )}
              >
                {item.title}
              </span>
            </li>
          ))
        )}
      </ul>
    </ParentCard>
  );
}
