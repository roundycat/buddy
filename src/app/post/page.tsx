import { Suspense } from "react";
import { MemoryPostView } from "@/frontend/features/memory-post/components/MemoryPostView";
import { TopBrandBar } from "@/frontend/shared/components/TopBrandBar";
import { SoftSkeleton } from "@/frontend/shared/components/ChildUi";
import { ChildConsentPendingScreen } from "@/frontend/features/consent/components/ChildConsentPendingScreen";
import { loadChildConsentPending, loadMemoryPost } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

export default async function PostPage() {
  // Loading the post writes letters and may ask the LLM for one
  if (await loadChildConsentPending()) {
    return <ChildConsentPendingScreen showBack />;
  }
  const post = await loadMemoryPost();

  return (
    <div className="paper-room mx-auto max-w-lg px-5  pt-2 md:max-w-2xl md:px-8">
      <TopBrandBar />

      <div className="mt-8 mb-6 text-center">
        <p className="text-xs tracking-[0.14em] text-bedi-slate/40">
          Memory Post
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-bedi-slate">
          기억 우체국
        </h1>
      </div>

      <Suspense fallback={<SoftSkeleton rows={2} label="편지를 꺼내는 중" />}>
        <MemoryPostView
          title={post.title}
          companionNote={post.companionNote}
          letters={post.letters}
        />
      </Suspense>
    </div>
  );
}
