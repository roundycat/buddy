import { Suspense } from "react";
import { MemoryPostView } from "@/frontend/features/memory-post/components/MemoryPostView";
import { TopBrandBar } from "@/frontend/shared/components/TopBrandBar";
import { loadMemoryPost } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

export default async function PostPage() {
  const post = await loadMemoryPost();

  return (
    <div className="paper-room mx-auto max-w-lg px-5 pb-8 pt-2">
      <TopBrandBar />

      <div className="mt-8 mb-6 text-center">
        <p className="text-xs tracking-[0.14em] text-bedi-slate/40">
          Memory Post
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-bedi-slate">
          기억 우체국
        </h1>
      </div>

      <Suspense fallback={<p className="text-sm text-bedi-slate/45">불러오는 중…</p>}>
        <MemoryPostView
          title={post.title}
          companionNote={post.companionNote}
          letters={post.letters}
        />
      </Suspense>
    </div>
  );
}
