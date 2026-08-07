import type { WalletLedgerEntry } from "@/frontend/shared/types/wallet";
import { formatKoreanShortDateTime } from "@/frontend/shared/lib/date";
import { SoftEmptyState } from "@/frontend/shared/components/ChildUi";

interface WalletViewProps {
  balance: number;
  currencyLabel: string;
  currencyHint: string;
  ledger: WalletLedgerEntry[];
}

export function WalletView({
  balance,
  currencyLabel,
  currencyHint,
  ledger,
}: WalletViewProps) {
  return (
    <div className="feature-enter space-y-5">
      <div className="rounded-2xl border border-bedi-sage/25 bg-bedi-sage/10 px-5 py-5 shadow-softer">
        <p className="text-[11px] tracking-wide text-bedi-sage">{currencyLabel}</p>
        <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-bedi-slate">
          {balance}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-bedi-slate/65">
          {currencyHint}
        </p>
      </div>

      <section>
        <h2 className="text-[15px] font-medium text-bedi-slate">최근 내역</h2>
        <p className="mt-1 text-xs text-bedi-slate/40">
          미션을 완료하면 여기에 쌓여요
        </p>

        {ledger.length === 0 ? (
          <SoftEmptyState
            className="mt-4"
            icon="⭐"
            title="아직 모은 별조각이 없어요"
            description="오늘의 모험을 하나 마치면 첫 별조각이 여기에 반짝여요."
          />
        ) : (
          <ul className="mt-4 space-y-2.5">
            {ledger.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-bedi-slate/8 bg-white/90 px-4 py-3.5 shadow-softer"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-bedi-slate">{entry.reason}</p>
                  <p className="mt-0.5 text-[10px] tabular-nums text-bedi-slate/35">
                    {formatKoreanShortDateTime(entry.createdAt)}
                  </p>
                </div>
                <span
                  className={
                    entry.amount >= 0
                      ? "shrink-0 text-sm font-medium tabular-nums text-bedi-sage"
                      : "shrink-0 text-sm font-medium tabular-nums text-bedi-rose"
                  }
                >
                  {entry.amount >= 0 ? `+${entry.amount}` : entry.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
