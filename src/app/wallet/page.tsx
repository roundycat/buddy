import Link from "next/link";
import { WalletView } from "@/frontend/features/wallet/components/WalletView";
import { FeaturePageShell } from "@/frontend/shared/components/FeaturePageShell";
import { loadWallet } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const wallet = await loadWallet();

  return (
    <FeaturePageShell
      balance={wallet.balance}
      eyebrow="Wallet"
      title="나의 별조각"
      description={
        <>
          <Link
            href="/adventure"
            className="text-bedi-sage underline-offset-2 hover:underline"
          >
            오늘의 모험
          </Link>
          에서 미션을 완료하면 쌓여요
        </>
      }
    >
      <WalletView
        balance={wallet.balance}
        currencyLabel={wallet.currencyLabel}
        currencyHint={wallet.currencyHint}
        ledger={wallet.ledger}
      />
    </FeaturePageShell>
  );
}
