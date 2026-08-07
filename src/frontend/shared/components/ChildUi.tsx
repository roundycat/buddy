import type { ReactNode } from "react";
import { cn } from "@/frontend/shared/lib/utils";

/**
 * Child-facing UI primitives.
 *
 * The mirror of `ParentUi` for the child app: same three states
 * (loading / empty / error) but warm, rounded and never clinical.
 * A child should read these and feel invited, not blocked.
 */

/** Soft pulse block — the base unit of every child skeleton. */
export function SoftPulse({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-full bg-bedi-slate/[0.07]",
        className
      )}
      aria-hidden
    />
  );
}

/**
 * Card-shaped placeholder while a feature's data arrives.
 * Announces politely so screen readers know something is coming.
 */
export function SoftSkeleton({
  rows = 3,
  className,
  label = "불러오는 중",
}: {
  rows?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-bedi-slate/[0.07] bg-white/70 p-5 shadow-softer"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <SoftPulse className="h-3.5 w-28 rounded-lg" />
          <SoftPulse className="mt-3 h-3 w-full rounded-lg" />
          <SoftPulse className="mt-2 h-3 w-4/5 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/**
 * Full-page placeholder used by route Suspense / dynamic import fallbacks.
 * Mirrors the shape of a feature page so the layout does not jump.
 */
export function PageSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div
      className="mx-auto w-full max-w-lg px-1 md:max-w-2xl"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">불러오는 중</span>
      <div className="mb-6 flex flex-col items-center">
        <SoftPulse className="h-2.5 w-24 rounded-lg" />
        <SoftPulse className="mt-3 h-5 w-40 rounded-lg" />
      </div>
      <SoftSkeleton rows={rows} />
    </div>
  );
}

/**
 * Placeholder inside a memory card while the day's memory is fetched.
 * Keeps the flower/leaf silhouette so the card does not resize on arrival.
 */
export function MemoryCardSkeleton({ label = "기억을 여는 중" }: { label?: string }) {
  return (
    <div
      className="px-5 pb-7 pt-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="flex flex-col items-center">
        <SoftPulse className="h-20 w-20" />
        <SoftPulse className="mt-4 h-2.5 w-16 rounded-lg" />
        <SoftPulse className="mt-2.5 h-4 w-32 rounded-lg" />
      </div>
      <div className="mt-6 space-y-3">
        <SoftPulse className="h-20 w-full rounded-2xl" />
        <SoftPulse className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Home placeholder shaped like the companion room: a soft avatar disc
 * over a speech bubble, so the friend appears to be walking in rather
 * than the screen being blank.
 */
export function CompanionRoomSkeleton() {
  return (
    <main
      className="paper-room mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-5 md:max-w-2xl"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">친구를 부르는 중</span>
      <SoftPulse className="h-32 w-32 rounded-full" />
      <SoftPulse className="mt-6 h-3 w-24 rounded-lg" />
      <div className="mt-6 w-full rounded-3xl border border-bedi-slate/[0.07] bg-white/70 p-5 shadow-softer">
        <SoftPulse className="h-3 w-full rounded-lg" />
        <SoftPulse className="mt-2 h-3 w-3/5 rounded-lg" />
      </div>
    </main>
  );
}

/**
 * Empty state for a child feature.
 * Never says "no data" — it says the story has not started yet.
 */
export function SoftEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  /** Emoji or small illustration — kept decorative for screen readers */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed border-bedi-slate/15 bg-white/60 px-6 py-10 text-center",
        className
      )}
    >
      {icon ? (
        <div
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-bedi-cream text-2xl"
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-medium text-bedi-slate">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-bedi-slate/50">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/**
 * Error state for a child feature.
 * Reads as reassurance first, problem second — and never blames the child.
 */
export function SoftErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl border border-bedi-rose/25 bg-bedi-rose/[0.07] px-4 py-3",
        className
      )}
    >
      <p className="text-sm leading-relaxed text-bedi-slate/75">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 min-h-11 rounded-full px-3 text-sm font-medium text-bedi-slate/70 underline-offset-4 transition-colors hover:text-bedi-slate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40"
        >
          다시 해볼까요
        </button>
      ) : null}
    </div>
  );
}
