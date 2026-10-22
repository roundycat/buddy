import { FeaturePageShell } from "@/frontend/shared/components/FeaturePageShell";
import { SharingView } from "@/frontend/features/sharing/components/SharingView";
import { loadChildSharing } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

/**
 * 보호자와 나누기 — child-controlled sharing.
 */
export default async function SharingPage() {
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
