import { Suspense } from "react";
import { EmotionGardenView } from "@/frontend/features/emotion-garden/components/EmotionGardenView";
import { FeaturePageShell } from "@/frontend/shared/components/FeaturePageShell";
import { loadEmotionGarden } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

export default async function GardenPage() {
  const garden = await loadEmotionGarden();

  return (
    <FeaturePageShell
      eyebrow="Emotion Garden"
      title="감정 정원"
      description="감정을 기록하는 게 아니라, 키워요"
    >
      <Suspense fallback={<p className="text-sm text-bedi-slate/45">불러오는 중…</p>}>
        <EmotionGardenView initial={garden} />
      </Suspense>
    </FeaturePageShell>
  );
}
