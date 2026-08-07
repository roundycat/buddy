"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  ChevronLeft,
  Link2,
  LogOut,
  Palette,
  Settings,
  Sparkles,
  UserRound,
  UserX,
} from "lucide-react";
import { GuardianInviteCard } from "@/frontend/features/guardian/components/GuardianInviteCard";
import { useAuthActions } from "@/frontend/shared/hooks/useAuthActions";
import { cn } from "@/frontend/shared/lib/utils";

const menuItemClass =
  "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-bedi-slate/75 transition-colors hover:bg-bedi-slate/[0.04] disabled:opacity-50";

function MenuSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="py-1">
      <p className="px-3.5 pb-1 pt-1.5 text-[10px] font-medium tracking-wide text-bedi-slate/35">
        {label}
      </p>
      {children}
    </div>
  );
}

export function TopBrandBar({
  balance: initialBalance,
  showBack = true,
  notificationCount = 0,
  onOpenNotifications,
}: {
  balance?: number;
  /** false on main waiting room only */
  showBack?: boolean;
  /** Pending child-facing notifications. */
  notificationCount?: number;
  /** Opens the shared notification center. Other pages return to it on home. */
  onOpenNotifications?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout: logoutSession, deleteAccount: deleteAccountSession, resetPersona } =
    useAuthActions();
  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState(initialBalance ?? 0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof initialBalance === "number") {
      setBalance(initialBalance);
    }
  }, [initialBalance]);

  useEffect(() => {
    async function refreshBalance() {
      try {
        const res = await fetch("/api/wallet");
        if (!res.ok) return;
        const data = (await res.json()) as { balance?: number };
        if (typeof data.balance === "number") setBalance(data.balance);
      } catch {
        /* ignore */
      }
    }

    void refreshBalance();

    function onWalletUpdate() {
      void refreshBalance();
    }

    window.addEventListener("bedi:wallet", onWalletUpdate);
    return () => window.removeEventListener("bedi:wallet", onWalletUpdate);
  }, []);

  useEffect(() => {
    if (!open && !inviteOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setInviteOpen(false);
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setInviteOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, inviteOpen]);

  async function goOnboarding() {
    if (busy) return;
    const ok = window.confirm(
      "Beddy를 다시 사귈까요?\n대화·정원·모험·소원 기록이 모두 지워지고 처음부터 다시 시작해요.\n\n그림만 바꾸려면 「다른 친구 만나보기」를 눌러 주세요."
    );
    if (!ok) return;
    setBusy(true);
    try {
      await resetPersona();
      setOpen(false);
      setInviteOpen(false);
      router.replace("/onboarding");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function goRedrawAvatar() {
    setOpen(false);
    setInviteOpen(false);
    // Always land on waiting room so the redraw UI is visible
    if (pathname === "/") {
      // Defer so the menu unmounts first, then WaitingRoom can show progress
      window.setTimeout(() => {
        window.dispatchEvent(new Event("bedi:redraw-avatar"));
      }, 0);
      return;
    }
    router.push("/?redrawAvatar=1");
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      setOpen(false);
      setInviteOpen(false);
      await logoutSession();
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (busy) return;
    const ok = window.confirm(
      "정말 회원 탈퇴할까요?\n계정과 대화·정원·지갑 데이터가 삭제되며 되돌릴 수 없어요."
    );
    if (!ok) return;
    setBusy(true);
    try {
      setOpen(false);
      setInviteOpen(false);
      await deleteAccountSession();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "회원 탈퇴에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  return (
    <header className="relative z-40 px-5 pt-4">
      <div className="mx-auto flex max-w-lg items-center justify-between md:max-w-2xl">
        <div className="flex min-w-[4.5rem] items-center gap-1.5 text-bedi-slate/50">
          {showBack ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="뒤로가기"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-bedi-slate/45 transition-colors hover:bg-bedi-slate/5 hover:text-bedi-slate/75"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
            </button>
          ) : null}

          <Link
            href="/wallet"
            title="별조각 · 미션 보상"
            aria-label={`별조각 ${balance}개`}
            className="flex items-center gap-1 rounded-full border border-bedi-sage/20 bg-bedi-sage/10 px-2 py-0.5 text-bedi-slate/65 transition-colors hover:border-bedi-sage/35 hover:bg-bedi-sage/15 hover:text-bedi-slate"
          >
            <Sparkles className="h-3 w-3 text-bedi-sage" strokeWidth={1.75} />
            <span className="text-xs font-medium tabular-nums">{balance}</span>
          </Link>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-display text-xl font-semibold tracking-tight text-bedi-slate"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192.png?v=4"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-[8px] object-cover"
          />
          Beddy
        </Link>

        <div className="relative flex items-center gap-0.5" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setInviteOpen(false);
              if (onOpenNotifications) {
                onOpenNotifications();
              } else {
                router.push("/?notifications=1");
              }
            }}
            aria-label={
              notificationCount > 0 ? `알림 ${notificationCount}개` : "알림"
            }
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-bedi-slate/40 transition-colors hover:bg-bedi-slate/5 hover:text-bedi-slate/70"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
            {notificationCount > 0 ? (
              <span
                className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bedi-rose px-1 text-[9px] font-bold text-white"
                aria-hidden
              >
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              setInviteOpen(false);
            }}
            aria-label="설정"
            aria-expanded={open || inviteOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full text-bedi-slate/40 transition-colors hover:bg-bedi-slate/5 hover:text-bedi-slate/70"
          >
            <Settings className="h-4 w-4" strokeWidth={1.5} />
          </button>

          {open ? (
            <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-bedi-slate/10 bg-white/95 py-1 shadow-soft backdrop-blur-sm">
              <MenuSection label="바로가기">
                <Link
                  href="/storybook"
                  onClick={() => setOpen(false)}
                  className={menuItemClass}
                >
                  <BookOpen className="h-3.5 w-3.5 text-bedi-sage" strokeWidth={1.5} />
                  우리의 이야기 책
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setInviteOpen(true);
                  }}
                  className={menuItemClass}
                >
                  <Link2 className="h-3.5 w-3.5 text-bedi-slate/40" strokeWidth={1.5} />
                  보호자와 연결하기
                </button>
              </MenuSection>

              <div className="mx-3 border-t border-bedi-slate/8" />

              <MenuSection label="친구">
                <button
                  type="button"
                  disabled={busy}
                  onClick={goRedrawAvatar}
                  className={menuItemClass}
                >
                  <Palette className="h-3.5 w-3.5 text-bedi-sage" strokeWidth={1.5} />
                  다른 친구 만나보기
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void goOnboarding()}
                  className={menuItemClass}
                >
                  <UserRound className="h-3.5 w-3.5 text-bedi-slate/40" strokeWidth={1.5} />
                  Beddy 다시 사귀기
                </button>
              </MenuSection>

              <div className="mx-3 border-t border-bedi-slate/8" />

              <MenuSection label="계정">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void logout()}
                  className={menuItemClass}
                >
                  <LogOut className="h-3.5 w-3.5 text-bedi-slate/40" strokeWidth={1.5} />
                  로그아웃
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void deleteAccount()}
                  className={cn(
                    menuItemClass,
                    "text-bedi-rose/80 hover:bg-bedi-rose/5"
                  )}
                >
                  <UserX className="h-3.5 w-3.5 text-bedi-rose/60" strokeWidth={1.5} />
                  회원 탈퇴
                </button>
              </MenuSection>
            </div>
          ) : null}

          {inviteOpen ? (
            <div className="absolute right-0 top-full z-40 mt-2 w-64">
              <GuardianInviteCard
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
