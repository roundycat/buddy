import { MemoryTimelineView } from "@/frontend/features/memory-timeline/components/MemoryTimelineView";
import { FeaturePageShell } from "@/frontend/shared/components/FeaturePageShell";
import { loadMemoryTimeline } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
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
