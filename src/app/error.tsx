"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <main className="paper-room mx-auto flex min-h-screen w-full max-w-lg items-center justify-center px-5 py-10">
      <section className="w-full rounded-2xl border border-bedi-rose/20 bg-white p-5 shadow-softer">
        <h1 className="text-lg font-semibold text-bedi-slate">
          잠시 문제가 생겼어요
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-bedi-slate/60">
          새로고침하거나 다시 시도해 주세요. 문제가 계속되면 잠시 후 다시
          접속해 주세요.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 h-11 rounded-xl bg-bedi-slate px-4 text-sm font-medium text-white transition-colors hover:bg-bedi-slate/90"
        >
          다시 시도
        </button>
      </section>
    </main>
  );
}
