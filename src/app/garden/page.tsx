import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import { FeaturePageShell } from "@/frontend/shared/components/FeaturePageShell";
import { SoftSkeleton } from "@/frontend/shared/components/ChildUi";
import { loadEmotionGarden } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

const EmotionGardenView = nextDynamic(
  () =>
    import(
      "@/frontend/features/emotion-garden/components/EmotionGardenView"
    ).then((m) => m.EmotionGardenView),
  {
    loading: () => <SoftSkeleton rows={2} label="정원을 여는 중" />,
  }
);

export default async function GardenPage() {
  const garden = await loadEmotionGarden();

  return (
    <FeaturePageShell
      eyebrow="Emotion Garden"
      title="감정 정원"
      description="감정을 기록하는 게 아니라, 키워요. 모든 감정은 아름다운 꽃이 됩니다."
    >
      <Suspense fallback={<SoftSkeleton rows={2} label="정원을 여는 중" />}>
        <EmotionGardenView initial={garden} />
      </Suspense>
    </FeaturePageShell>
  );
}
