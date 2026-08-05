import { MoodCalendar } from "@/frontend/features/timeline/components/MoodCalendar";

export const dynamic = "force-dynamic";

/**
 * Beddylog — Sumlog-style visual calendar journal.
 */
export default function TimelinePage() {
  return <MoodCalendar year={2026} month={8} today={4} />;
}
