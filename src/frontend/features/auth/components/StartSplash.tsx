"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * App launch splash — brand-first, then continue to login.
 * Always clears any leftover session so the path is start → login → (onboarding|/).
 */
export function StartSplash() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [busy, setBusy] = useState<"login" | "signup" | null>(null);

  function loginPath(mode?: "signup") {
    const params = new URLSearchParams();
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      params.set("next", next);
    }
    if (mode) params.set("mode", mode);
    const q = params.toString();
    return q ? `/login?${q}` : "/login";
  }

  async function goAuth(mode?: "signup") {
    if (busy) return;
    setBusy(mode ?? "login");
    try {
      // Drop leftover session so /login is not skipped by middleware
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* still continue to login */
    }
    window.location.assign(loginPath(mode));
  }

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 18%, #E8F3F8 0%, transparent 58%), radial-gradient(ellipse 70% 50% at 80% 90%, #F0E8E4 0%, transparent 50%), linear-gradient(180deg, #F7FBFC 0%, #FBFAF7 45%, #F3F0EB 100%)",
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-20 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-512.png?v=4"
          alt=""
          width={96}
          height={96}
          className="h-24 w-24 rounded-[28px] object-cover"
          style={{ animation: "waiting-fade-up 0.9s ease-out both" }}
        />
        <p
          className="mt-5 font-display text-5xl font-semibold tracking-tight text-bedi-slate sm:text-6xl"
          style={{ animation: "waiting-fade-up 0.9s ease-out 0.06s both" }}
        >
          Beddy
        </p>

        <h1
          className="mt-6 max-w-sm text-[22px] font-semibold leading-snug tracking-tight text-bedi-slate sm:text-2xl"
          style={{ animation: "waiting-fade-up 0.9s ease-out 0.12s both" }}
        >
          답답한 병실 안,
          <br />
          나만의 든든한 Beddy
        </h1>

        <p
          className="mt-4 max-w-xs text-sm leading-relaxed text-bedi-slate/50"
          style={{ animation: "waiting-fade-up 0.9s ease-out 0.22s both" }}
        >
          병원에서 보낸 오늘도, 반짝이는 기억이 됩니다.
        </p>

        <div
          className="mt-12 flex w-full max-w-xs flex-col gap-3"
          style={{ animation: "waiting-fade-up 0.9s ease-out 0.34s both" }}
        >
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void goAuth()}
            className="flex h-12 items-center justify-center rounded-xl bg-bedi-slate text-sm font-medium text-white transition-colors hover:bg-bedi-slate/90 disabled:opacity-60"
          >
            {busy === "login" ? "이동 중…" : "시작하기"}
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void goAuth("signup")}
            className="flex h-11 items-center justify-center text-sm text-bedi-slate/45 transition-colors hover:text-bedi-slate/70 disabled:opacity-60"
          >
            {busy === "signup" ? "이동 중…" : "아직 계정이 없다면 회원가입"}
          </button>
        </div>
      </div>
    </main>
  );
}
