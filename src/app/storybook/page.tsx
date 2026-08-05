import { GrowthStorybookView } from "@/frontend/features/growth-storybook/components/GrowthStorybookView";
import { TopBrandBar } from "@/frontend/shared/components/TopBrandBar";
import { loadGrowthStorybook } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

export default async function StorybookPage() {
  const book = await loadGrowthStorybook();

  return (
    <div className="paper-room mx-auto max-w-lg px-5 pb-8 pt-2">
      <TopBrandBar />

      <div className="mt-8 mb-6 text-center">
        <p className="text-xs tracking-[0.14em] text-bedi-slate/40">
          Our Storybook
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-bedi-slate">
          우리의 이야기 책
        </h1>
        <p className="mt-2 text-sm text-bedi-slate/45">
          함께한 날이 희망찬 내일로 이어져요
        </p>
      </div>

      <GrowthStorybookView book={book} />
    </div>
  );
}
