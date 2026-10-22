import { FeaturePageShell } from "@/frontend/shared/components/FeaturePageShell";
import { SharingView } from "@/frontend/features/sharing/components/SharingView";
import { loadChildConsentPending, loadChildSharing } from "@/app/_server/loaders";
import { ChildConsentPendingScreen } from "@/frontend/features/consent/components/ChildConsentPendingScreen";

export const dynamic = "force-dynamic";

/**
 * 보호자와 나누기 — child-controlled sharing.
 */
export default async function SharingPage() {
  if (await loadChildConsentPending()) {
    return <ChildConsentPendingScreen showBack />;
  }
  const sharing = await loadChildSharing();

  return (
    <FeaturePageShell
      eyebrow="Sharing"
      title="보호자와 나누기"
      description="무엇을 보호자와 나눌지 네가 정할 수 있어."
    >
      <SharingView initialChoices={sharing.choices} />
    </FeaturePageShell>
  );
}
