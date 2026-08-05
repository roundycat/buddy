"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, UserX } from "lucide-react";

/**
 * Guardian-only chrome — never links into the child waiting room.
 */
export function GuardianBrandBar({ childName }: { childName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setOpen(false);
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (busy) return;
    const ok = window.confirm(
      "정말 회원 탈퇴할까요?\n보호자 계정과 아이 연결 정보가 삭제되며 되돌릴 수 없어요."
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/delete-account", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "회원 탈퇴에 실패했습니다.");
      }
      setOpen(false);
      router.replace("/login");
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "회원 탈퇴에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="relative z-30 px-5 pt-4">
      <div className="mx-auto flex max-w-lg items-center justify-between">
        <div className="min-w-0 text-left">
          <p className="text-[10px] tracking-[0.14em] text-bedi-slate/35">
            GUARDIAN
          </p>
          {childName ? (
            <p className="truncate text-xs text-bedi-slate/55">{childName}</p>
          ) : (
            <p className="text-xs text-bedi-slate/40">보호자 공간</p>
          )}
        </div>

        <span className="inline-flex items-center gap-1.5 font-display text-xl font-semibold tracking-tight text-bedi-slate">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-512.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-[8px] object-cover"
          />
          Beddy
        </span>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="보호자 설정"
            aria-expanded={open}
            className="flex h-8 w-8 items-center justify-center rounded-full text-bedi-slate/40 transition-colors hover:bg-bedi-slate/5 hover:text-bedi-slate/70"
          >
            <Settings className="h-4 w-4" strokeWidth={1.5} />
          </button>

          {open ? (
            <div className="absolute right-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-2xl border border-bedi-slate/10 bg-white/95 py-1.5 shadow-soft backdrop-blur-sm">
              <button
                type="button"
                disabled={busy}
                onClick={() => void logout()}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-bedi-slate/75 transition-colors hover:bg-bedi-slate/[0.04] disabled:opacity-50"
              >
                <LogOut className="h-3.5 w-3.5 text-bedi-slate/40" strokeWidth={1.5} />
                로그아웃
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteAccount()}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-bedi-rose/80 transition-colors hover:bg-bedi-rose/5 disabled:opacity-50"
              >
                <UserX className="h-3.5 w-3.5 text-bedi-rose/60" strokeWidth={1.5} />
                회원 탈퇴
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
