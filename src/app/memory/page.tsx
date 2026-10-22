import { MemoryTimelineView } from "@/frontend/features/memory-timeline/components/MemoryTimelineView";
import { FeaturePageShell } from "@/frontend/shared/components/FeaturePageShell";
import {
  loadChildConsentPending,
  loadMemoryTimeline,
} from "@/app/_server/loaders";
import { ChildConsentPendingScreen } from "@/frontend/features/consent/components/ChildConsentPendingScreen";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  // Under 14: nothing is collected or generated until a guardian consents.
  if (await loadChildConsentPending()) {
    return <ChildConsentPendingScreen showBack />;
  }
  const memory = await loadMemoryTimeline();

  return (
    <FeaturePageShell
      eyebrow="AI Memory Timeline"
      title="우리가 함께 기억한 날들"
      description="미션이 만든 하루 이야기도 여기에 쌓여요"
    >
      <MemoryTimelineView
        title={memory.title}
        companionNote={memory.companionNote}
        events={memory.events}
      />
    </FeaturePageShell>
  );
}
