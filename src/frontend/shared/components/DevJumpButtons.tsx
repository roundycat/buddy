"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@/frontend/shared/hooks/useAuthActions";

/**
 * Development-only shortcuts. Never shown in production builds.
 */
export function DevJumpButtons() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, resetPersona } = useAuthActions({ redirectTo: "/start" });

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  if (
    pathname === "/login" ||
    pathname === "/start" ||
    pathname === "/onboarding" ||
    pathname === "/guardian" ||
    pathname.startsWith("/guardian/")
  ) {
    return null;
  }

  async function goLogin() {
    await logout();
  }

  async function goOnboarding() {
    const ok = window.confirm(
      "페르소나와 대화·정원·모험 기록을 모두 지우고 온보딩으로 돌아갈까요?"
    );
    if (!ok) return;
    await resetPersona();
    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <div className="fixed bottom-4 right-3 z-50 flex flex-col gap-2 sm:right-6">
      <button
        type="button"
        onClick={() => void goLogin()}
        className="min-h-11 rounded-full border border-bedi-slate/15 bg-white/95 px-3 py-2 text-[11px] font-medium text-bedi-slate/70 shadow-softer backdrop-blur-sm transition-colors hover:text-bedi-slate"
      >
        개발 · 로그인
      </button>
      <button
        type="button"
        onClick={() => void goOnboarding()}
        className="min-h-11 rounded-full border border-bedi-slate/15 bg-white/95 px-3 py-2 text-[11px] font-medium text-bedi-slate/70 shadow-softer backdrop-blur-sm transition-colors hover:text-bedi-slate"
      >
        개발 · 온보딩
      </button>
    </div>
  );
}
