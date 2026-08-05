"use client";

/**
 * Empty day — adult empty state.
 */
export function EmptyScheduleState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-700">등록된 일정이 없습니다</p>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
        피검사, 투약, 회진 등 자주 쓰는 항목을
        <br />
        선택해 빠르게 추가할 수 있습니다.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-slate-800 px-4 text-sm font-medium text-white"
      >
        일정 추가
      </button>
    </div>
  );
}
