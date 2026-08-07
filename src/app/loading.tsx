import { PageSkeleton } from "@/frontend/shared/components/ChildUi";

export default function GlobalLoading() {
  return (
    <main className="paper-room mx-auto flex min-h-screen w-full max-w-lg items-center justify-center px-5 py-10 md:max-w-2xl">
      <PageSkeleton rows={2} />
    </main>
  );
}
