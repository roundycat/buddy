import nextDynamic from "next/dynamic";
import { FeaturePageShell } from "@/frontend/shared/components/FeaturePageShell";
import { SoftSkeleton } from "@/frontend/shared/components/ChildUi";
import {
  loadChildConsentPending,
  loadWishTree,
} from "@/app/_server/loaders";
import { ChildConsentPendingScreen } from "@/frontend/features/consent/components/ChildConsentPendingScreen";

export const dynamic = "force-dynamic";

const WishTreeView = nextDynamic(
  () =>
    import(
      "@/frontend/features/wish-tree/components/WishTreeView"
    ).then((m) => m.WishTreeView),
  {
    loading: () => <SoftSkeleton rows={2} label="나무를 깨우는 중" />,
  }
);

export default async function WishPage() {
  // Under 14: nothing is collected or generated until a guardian consents.
  if (await loadChildConsentPending()) {
    return <ChildConsentPendingScreen showBack />;
  }
  const tree = await loadWishTree();

  return (
    <FeaturePageShell
      eyebrow="Wish Tree"
      title="마음 나무"
      description="마음이 잎이 되어, 나무가 기억해요"
    >
      <WishTreeView initial={tree} />
    </FeaturePageShell>
  );
}
