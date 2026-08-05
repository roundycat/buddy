import { GrowthJournalView } from "@/frontend/features/growth-journal/components/GrowthJournalView";
import { TopBrandBar } from "@/frontend/shared/components/TopBrandBar";
import { loadGrowthJournal } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

export default async function GrowthPage() {
  const growth = await loadGrowthJournal();

  return (
    <div className="paper-room mx-auto max-w-lg px-5 pb-8 pt-2">
      <TopBrandBar />

      <div className="mt-8 mb-6 text-center">
        <p className="text-xs tracking-[0.14em] text-bedi-slate/40">
          감정 및 성장 기록
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-bedi-slate">
          마음이 걸어온 길
        </h1>
      </div>

      <GrowthJournalView
        companionNote={growth.companionNote}
        moodSeries={growth.moodSeries}
        moments={growth.moments}
      />
    </div>
  );
}
