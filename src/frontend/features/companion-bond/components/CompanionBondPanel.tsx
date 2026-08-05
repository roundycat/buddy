"use client";

import { cn } from "@/frontend/shared/lib/utils";
import type {
  CareType,
  CompanionBondView,
} from "@/frontend/features/companion-bond/lib/companion-bond-api";

const CARE_LABELS: Record<CareType, string> = {
  cheer: "응원",
  hug: "안아주기",
  stay: "같이 있기",
};

/**
 * Compact mood + affinity + remaining care actions under the friend.
 */
export function CompanionBondPanel({
  bond,
  busy,
  onCare,
}: {
  bond: CompanionBondView | null;
  busy?: boolean;
  onCare: (type: CareType) => void;
}) {
  if (!bond) {
    return (
      <div className="mt-3 w-full max-w-[240px] text-center">
        <p className="text-[12px] text-bedi-slate/40" aria-live="polite">
          사이 정도를 불러오는 중…
        </p>
        <div className="mx-auto mt-2 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-bedi-slate/10">
          <div className="h-full w-1/5 animate-pulse rounded-full bg-bedi-sage/40" />
        </div>
      </div>
    );
  }

  const availableCares = (["cheer", "hug", "stay"] as CareType[]).filter(
    (type) => bond.caresAvailable.includes(type)
  );

  return (
    <div className="mt-3 w-full max-w-[240px] text-center">
      <p className="text-[12px] text-bedi-slate/55">
        <span className="text-bedi-slate/70">{bond.moodLabel}</span>
        <span className="mx-1.5 text-bedi-slate/25">·</span>
        <span>{bond.affinityLabel}</span>
      </p>

      <div
        className="mx-auto mt-2 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-bedi-slate/10"
        aria-label={`사이 정도 ${bond.affinity}`}
      >
        <div
          className="h-full rounded-full bg-bedi-sage/80 transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(4, bond.affinity)}%` }}
        />
      </div>

      {availableCares.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
          {availableCares.map((type) => (
            <button
              key={type}
              type="button"
              disabled={busy}
              onClick={() => onCare(type)}
              className={cn(
                "min-h-11 rounded-full px-3 text-[12px] text-bedi-slate/55 transition-colors",
                "hover:bg-bedi-sage/10 hover:text-bedi-slate disabled:opacity-50"
              )}
            >
              {CARE_LABELS[type]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
