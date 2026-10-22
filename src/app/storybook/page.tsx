import nextDynamic from "next/dynamic";
import { TopBrandBar } from "@/frontend/shared/components/TopBrandBar";
import { SoftSkeleton } from "@/frontend/shared/components/ChildUi";
import {
  loadChildConsentPending,
  loadGrowthStorybook,
} from "@/app/_server/loaders";
import { ChildConsentPendingScreen } from "@/frontend/features/consent/components/ChildConsentPendingScreen";

export const dynamic = "force-dynamic";

const GrowthStorybookView = nextDynamic(
  () =>
    import(
      "@/frontend/features/growth-storybook/components/GrowthStorybookView"
    ).then((m) => m.GrowthStorybookView),
  {
    loading: () => <SoftSkeleton rows={2} label="이야기를 펼치는 중" />,
  }
);

export default async function StorybookPage() {
  // Under 14: nothing is collected or generated until a guardian consents.
  if (await loadChildConsentPending()) {
    return <ChildConsentPendingScreen showBack />;
  }
  const book = await loadGrowthStorybook();

  return (
    <div className="paper-room mx-auto max-w-lg px-5  pt-2 md:max-w-2xl md:px-8">
      <TopBrandBar />

      <div className="mt-8 mb-6 text-center">
        <p className="text-xs tracking-[0.14em] text-bedi-slate/40">
          Storybook Engine
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-bedi-slate">
          우리가 함께 쓰는 이야기
        </h1>
        <p className="mt-2 text-sm text-bedi-slate/45">
          오늘의 마음이 평생 간직할 모험이 돼요
        </p>
      </div>

      <GrowthStorybookView book={book} />
    </div>
  );
}
