"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";

interface InvitePayload {
  code: string;
  expiresLabel: string;
  hint: string;
}

/**
 * Child invite code panel — opened from settings (TopBrandBar).
 */
export function GuardianInviteCard({
  className,
  open,
  onClose,
}: {
  className?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (rotate = false) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/guardian/invite", {
        method: rotate ? "POST" : "GET",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "코드를 불러오지 못했어요.");
      setInvite({
        code: data.code,
        expiresLabel: data.expiresLabel,
        hint: data.hint,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "코드를 불러오지 못했어요.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load(false);
  }, [open, load]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-bedi-slate/8 bg-white/95 px-4 py-4 text-center shadow-soft backdrop-blur-sm",
        className
      )}
    >
      <p className="text-[11px] tracking-wide text-bedi-slate/40">
        보호자 초대 코드
      </p>
      <p className="mt-1 text-xs text-bedi-slate/50">
        {invite?.hint ?? "보호자 휴대폰에 이 코드를 알려 주세요"}
      </p>

      <p
        className="mt-3 font-display text-3xl font-semibold tracking-[0.28em] text-bedi-slate"
        aria-live="polite"
      >
        {busy && !invite ? "······" : invite?.code ?? "······"}
      </p>

      {invite?.expiresLabel ? (
        <p className="mt-2 text-[10px] tabular-nums text-bedi-slate/35">
          {invite.expiresLabel}
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs text-bedi-rose" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void load(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-bedi-slate/10 px-3 py-1.5 text-[11px] text-bedi-slate/55 transition hover:bg-bedi-slate/5 disabled:opacity-50"
        >
          <RefreshCw className="h-3 w-3" strokeWidth={1.75} />
          새 코드
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-bedi-slate/35 hover:text-bedi-slate/55"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
