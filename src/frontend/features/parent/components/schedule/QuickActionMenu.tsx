"use client";

/**
 * Quick actions sheet for a single schedule occurrence.
 */
export function QuickActionMenu({
  open,
  title,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  actions: Array<{
    id: string;
    label: string;
    tone?: "default" | "danger";
    onClick: () => void;
  }>;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bedi-slate/25 backdrop-blur-[2px]"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={`${title} 빠른 작업`}
        className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-soft sm:rounded-3xl sm:pb-4"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-bedi-slate/15" />
        <p className="px-1 text-sm font-semibold text-slate-800">{title}</p>
        <ul className="mt-3 space-y-1.5">
          {actions.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                className={`flex h-12 w-full items-center rounded-xl px-4 text-left text-[15px] font-medium ${
                  action.tone === "danger"
                    ? "bg-rose-50 text-rose-600"
                    : "bg-white text-slate-800"
                }`}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-xl text-sm text-slate-400"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
