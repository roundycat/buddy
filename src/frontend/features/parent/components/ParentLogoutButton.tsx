"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuthActions } from "@/frontend/shared/hooks/useAuthActions";
import { cn } from "@/frontend/shared/lib/utils";

/**
 * Guardian logout control — header icon or full-width profile button.
 */
export function ParentLogoutButton({
  variant = "card",
}: {
  variant?: "card" | "header";
}) {
  const { logout } = useAuthActions();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  }

  if (variant === "header") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void onLogout()}
        aria-label="로그아웃"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          "text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700",
          "disabled:opacity-50"
        )}
      >
        <LogOut className="h-4 w-4" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onLogout()}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
    >
      <LogOut className="h-4 w-4 text-slate-400" strokeWidth={1.6} />
      {busy ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
