"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { HeartHandshake } from "lucide-react";
import { GuardianInviteCard } from "@/frontend/features/guardian/components/GuardianInviteCard";
import { fetchChildConsent } from "@/frontend/features/consent/lib/consent-api";
import { cn } from "@/frontend/shared/lib/utils";

const POLL_MS = 10_000;

const STEPS = [
  "보호자가 Beddy에 보호자 계정으로 가입해요.",
  "아래 코드를 보호자에게 알려 줘요.",
  "보호자가 동의하면 바로 시작할 수 있어!",
];

/**
 * Under-14 child waiting for legal-guardian consent.
 * Shows the guardian invite code and quietly checks whether consent arrived.
 */
export function ConsentPendingPanel({
  onGranted,
  footer,
  className,
}: {
  /** Called once when the guardian's consent has arrived */
  onGranted: () => void;
  footer?: ReactNode;
  className?: string;
}) {
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const grantedRef = useRef(false);
  const onGrantedRef = useRef(onGranted);

  useEffect(() => {
    onGrantedRef.current = onGranted;
  }, [onGranted]);

  const check = useCallback(async (manual: boolean) => {
    if (grantedRef.current) return;
    if (manual) {
      setChecking(true);
      setNote(null);
    }
    try {
      const view = await fetchChildConsent();
      if (view.status !== "pending") {
        grantedRef.current = true;
        setNote("보호자가 동의했어! 이제 시작해 볼까?");
        onGrantedRef.current();
        return;
      }
      if (manual) {
        setNote(
          "아직 동의를 기다리고 있어. 보호자가 코드를 넣으면 바로 알 수 있어."
        );
      }
    } catch {
      if (manual) setNote("지금은 확인하지 못했어. 조금 뒤에 다시 눌러 줘.");
    } finally {
      if (manual) setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check(false);
    const timer = window.setInterval(() => void check(false), POLL_MS);
    return () => window.clearInterval(timer);
  }, [check]);

  return (
    <section
      className={cn(
        "rounded-3xl border border-bedi-slate/[0.08] bg-white/85 px-5 py-6 text-center shadow-softer",
        className
      )}
      aria-labelledby="consent-pending-title"
    >
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-bedi-cream text-bedi-sage"
        aria-hidden
      >
        <HeartHandshake className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h1
        id="consent-pending-title"
        className="mt-4 text-lg font-semibold tracking-tight text-bedi-slate"
      >
        보호자 동의가 필요해요
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-bedi-slate/55">
        만 14세 미만 친구는 보호자(엄마·아빠 같은 법정대리인)가 먼저 동의해 줘야
        베디랑 이야기하고 기록을 남길 수 있어.
      </p>

      <ol className="mx-auto mt-5 max-w-xs space-y-2 text-left">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className="flex items-start gap-2.5 text-[13px] leading-snug text-bedi-slate/70"
          >
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bedi-sage/15 text-[11px] font-medium text-bedi-slate/70">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <GuardianInviteCard open className="mx-auto mt-5 max-w-xs" />

      <button
        type="button"
        onClick={() => void check(true)}
        disabled={checking}
        className="mt-5 h-11 w-full max-w-xs rounded-xl bg-bedi-slate text-sm font-medium text-white transition-colors hover:bg-bedi-slate/90 disabled:opacity-50"
      >
        {checking ? "확인하는 중…" : "보호자가 동의했는지 확인하기"}
      </button>

      <p
        className="mx-auto mt-3 min-h-[1.25rem] max-w-xs text-xs leading-relaxed text-bedi-slate/50"
        aria-live="polite"
      >
        {note ?? "기다리는 동안에는 대화나 기록이 저장되지 않아. 천천히 기다려도 괜찮아."}
      </p>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </section>
  );
}
