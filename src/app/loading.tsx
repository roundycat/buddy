export default function GlobalLoading() {
  return (
    <main className="paper-room mx-auto flex min-h-screen w-full max-w-lg items-center justify-center px-5 py-10">
      <div className="w-full rounded-2xl border border-bedi-slate/10 bg-white p-5 shadow-softer">
        <div className="h-4 w-32 animate-pulse rounded bg-bedi-slate/10" />
        <div className="mt-3 h-3 w-full animate-pulse rounded bg-bedi-slate/10" />
        <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-bedi-slate/10" />
      </div>
    </main>
  );
}
