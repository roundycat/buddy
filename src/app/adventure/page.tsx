import { Suspense } from "react";
import { AdventureQuestView } from "@/frontend/features/adventure-quest/components/AdventureQuestView";
import { FeaturePageShell } from "@/frontend/shared/components/FeaturePageShell";
import { loadAdventureQuest } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

export default async function AdventurePage() {
  const quest = await loadAdventureQuest();

  return (
    <FeaturePageShell
      eyebrow="Today's Adventure"
      title="오늘의 작은 모험"
    >
      <Suspense fallback={<p className="text-sm text-bedi-slate/45">불러오는 중…</p>}>
        <AdventureQuestView initial={quest} />
      </Suspense>
    </FeaturePageShell>
  );
}
