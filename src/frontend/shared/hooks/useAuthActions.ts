"use client";

import { useCallback } from "react";
import { fetchJson } from "@/frontend/shared/api/fetch-json";

const DEFAULT_REDIRECT = "/login";

type RedirectOption = boolean | string;

function resolveRedirect(option: RedirectOption | undefined, fallback: string) {
  if (option === false) return null;
  if (typeof option === "string") return option;
  return fallback;
}

/**
 * Shared auth mutations for child (TopBrandBar) and parent logout flows.
 * Hard navigation clears session cookies reliably after cookie mutations.
 */
export function useAuthActions(options?: { redirectTo?: string }) {
  const defaultRedirect = options?.redirectTo ?? DEFAULT_REDIRECT;

  const logout = useCallback(
    async (opts?: { redirect?: RedirectOption }) => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      const dest = resolveRedirect(opts?.redirect, defaultRedirect);
      if (dest) window.location.assign(dest);
    },
    [defaultRedirect]
  );

  const deleteAccount = useCallback(
    async (opts?: { redirect?: RedirectOption }) => {
      await fetchJson(
        "/api/auth/delete-account",
        { method: "POST" },
        "회원 탈퇴를 하지 못했어요. 잠시 뒤에 다시 해 주세요."
      );
      const dest = resolveRedirect(opts?.redirect, defaultRedirect);
      if (dest) window.location.assign(dest);
    },
    [defaultRedirect]
  );

  const resetPersona = useCallback(async () => {
    await fetch("/api/dev/reset-persona", { method: "POST" });
  }, []);

  return { logout, deleteAccount, resetPersona };
}
