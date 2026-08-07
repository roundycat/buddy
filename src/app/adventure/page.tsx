import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import { FeaturePageShell } from "@/frontend/shared/components/FeaturePageShell";
import { SoftSkeleton } from "@/frontend/shared/components/ChildUi";
import { loadAdventureQuest } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

const AdventureQuestView = nextDynamic(
  () =>
    import(
      "@/frontend/features/adventure-quest/components/AdventureQuestView"
    ).then((m) => m.AdventureQuestView),
  {
    loading: () => <SoftSkeleton rows={2} label="모험을 준비하는 중" />,
  }
);

export default async function AdventurePage() {
  const quest = await loadAdventureQuest();

  return (
    <FeaturePageShell eyebrow="Today's Adventure" title="오늘의 작은 모험">
      <Suspense fallback={<SoftSkeleton rows={2} label="모험을 준비하는 중" />}>
        <AdventureQuestView initial={quest} />
      </Suspense>
    </FeaturePageShell>
  );
}
