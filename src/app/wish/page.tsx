import { WishTreeView } from "@/frontend/features/wish-tree/components/WishTreeView";
import { FeaturePageShell } from "@/frontend/shared/components/FeaturePageShell";
import { loadWishTree } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

export default async function WishPage() {
  const tree = await loadWishTree();

  return (
    <FeaturePageShell
      eyebrow="Wish Tree"
      title="소원 나무"
      description="희망을 걸어 두고, 베디가 기억해요"
    >
      <WishTreeView initial={tree} />
    </FeaturePageShell>
  );
}
