"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBrandBar } from "@/frontend/shared/components/TopBrandBar";
import { ConsentPendingPanel } from "@/frontend/features/consent/components/ConsentPendingPanel";

/**
 * Full child page shown instead of AI / data features while an under-14
 * child waits for legal-guardian consent. Refreshes into the real page
 * once consent arrives.
 */
export function ChildConsentPendingScreen({
  showBack = false,
}: {
  showBack?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="paper-room mx-auto min-h-[100dvh] max-w-lg px-5 pb-10 pt-2 md:max-w-2xl md:px-8">
      <TopBrandBar showBack={showBack} />
      <div className="mt-8">
        <ConsentPendingPanel
          onGranted={() => router.refresh()}
          footer={
            <Link
              href="/sharing"
              className="text-xs text-bedi-slate/45 underline-offset-2 hover:text-bedi-slate/70 hover:underline"
            >
              보호자와 무엇을 나눌지 미리 골라 볼래?
            </Link>
          }
        />
      </div>
    </div>
  );
}
