import { Suspense } from "react";
import { PictureDiaryView } from "@/frontend/features/picture-diary/components/PictureDiaryView";
import { TopBrandBar } from "@/frontend/shared/components/TopBrandBar";
import { SoftSkeleton } from "@/frontend/shared/components/ChildUi";
import { loadPictureDiary } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

export default async function DiaryPage() {
  const diary = await loadPictureDiary();

  return (
    <div className="paper-room mx-auto max-w-lg px-5  pt-2 md:max-w-2xl md:px-8">
      <TopBrandBar />

      <div className="mb-6 mt-8 text-center">
        <p className="text-xs tracking-[0.14em] text-bedi-slate/40">
          Picture Diary
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-bedi-slate">
          {diary.title}
        </h1>
      </div>

      <Suspense fallback={<SoftSkeleton rows={2} label="그림일기를 펴는 중" />}>
        <PictureDiaryView
          companionNote={diary.companionNote}
          entries={diary.entries}
        />
      </Suspense>
    </div>
  );
}
