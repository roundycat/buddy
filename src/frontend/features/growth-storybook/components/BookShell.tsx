"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { StorybookCover } from "@/frontend/shared/types/growth-storybook";
import { AvatarActor, useChildAvatar } from "./StorybookScene";

/** Hardcover front, closed. Tapping it opens the book like a real one. */
export function ClosedBook({
  cover,
  fallbackTitle,
  sealedAt,
  justSealed,
  opening,
  onOpen,
}: {
  cover: StorybookCover | null;
  fallbackTitle: string;
  sealedAt?: string;
  justSealed: boolean;
  opening: boolean;
  onOpen: () => void;
}) {
  const avatarUrl = useChildAvatar();
  const title = cover?.title ?? fallbackTitle;

  return (
    <div className="relative [perspective:1900px]">
      {/* Pages peeking out from under the cover */}
      <div className="absolute inset-x-3 bottom-1 top-3 rounded-[14px] bg-[#F6EFDF] shadow-[0_18px_40px_-18px_rgba(70,56,38,0.6)]" />
      <div className="absolute inset-x-4 bottom-2 top-4 rounded-[12px] bg-[#FFFCF3]" />

      <motion.button
        type="button"
        onClick={onOpen}
        disabled={opening}
        aria-label="이야기 책 펼치기"
        className="relative block w-full origin-left rounded-l-[7px] rounded-r-[20px] text-left [transform-style:preserve-3d]"
        initial={false}
        animate={
          opening
            ? { rotateY: -168, x: -6, boxShadow: "0 30px 60px -30px rgba(60,48,32,0.5)" }
            : { rotateY: 0, x: 0 }
        }
        whileHover={opening ? undefined : { rotateY: -7 }}
        transition={{ duration: opening ? 1 : 0.5, ease: [0.32, 0.02, 0.2, 1] }}
      >
        <div className="relative overflow-hidden rounded-l-[7px] rounded-r-[20px] bg-[linear-gradient(135deg,#5C6E5A_0%,#47594B_42%,#6B7A5C_100%)] px-7 py-12 shadow-[0_26px_54px_-24px_rgba(48,40,28,0.75)]">
          {/* cloth weave + spine */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:repeating-linear-gradient(90deg,rgba(255,255,255,0.4)_0_1px,transparent_1px_3px),repeating-linear-gradient(0deg,rgba(0,0,0,0.35)_0_1px,transparent_1px_3px)]" />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-7 bg-[linear-gradient(90deg,rgba(0,0,0,0.42),rgba(0,0,0,0.06))]" />
          <div className="pointer-events-none absolute inset-y-6 left-3 w-px bg-[#E8D9A8]/40" />
          {/* gold foil frame */}
          <div className="pointer-events-none absolute inset-4 rounded-[12px] border border-[#E6D5A2]/55" />
          <div className="pointer-events-none absolute inset-[22px] rounded-[8px] border border-[#E6D5A2]/25" />

          <div className="relative flex min-h-[420px] flex-col items-center justify-center text-center">
            <p className="text-[10px] font-semibold tracking-[0.34em] text-[#EBDCAE]/75">
              OUR STORYBOOK
            </p>

            <motion.h2
              className="mt-6 max-w-[15rem] font-display text-[26px] font-semibold leading-snug text-[#FBF6E4] [text-shadow:0_1px_0_rgba(0,0,0,0.35)]"
              animate={justSealed ? { opacity: [0.7, 1, 0.85, 1] } : undefined}
              transition={{ duration: 2.4, repeat: justSealed ? Infinity : 0 }}
            >
              {title}
            </motion.h2>

            {cover?.subtitle ? (
              <p className="mt-4 max-w-[14rem] text-[12px] leading-relaxed text-[#EBDCAE]/70">
                {cover.subtitle}
              </p>
            ) : null}

            <div className="my-7 flex items-center gap-2">
              <span className="h-px w-10 bg-[#E6D5A2]/45" />
              <Sparkles className="h-3.5 w-3.5 text-[#E6D5A2]/80" />
              <span className="h-px w-10 bg-[#E6D5A2]/45" />
            </div>

            <div className="relative h-28 w-28">
              <AvatarActor url={avatarUrl} side="left" size={100} />
              {!avatarUrl ? (
                <div className="flex h-full w-full items-center justify-center rounded-full border border-[#E6D5A2]/35 text-3xl">
                  📖
                </div>
              ) : null}
            </div>

            <p className="mt-6 text-[11px] tracking-[0.12em] text-[#EBDCAE]/60">
              {cover?.childName ? `${cover.childName}의 이야기` : "우리의 이야기"}
              {sealedAt ? ` · ${sealedAt.slice(0, 10)}` : ""}
            </p>
          </div>

          {/* light sweep */}
          <motion.div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_38%,rgba(255,255,255,0.28)_50%,transparent_62%)]"
            animate={{ x: ["-45%", "45%"] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.button>

      <div className="mt-5 text-center">
        {justSealed ? (
          <p className="mb-2 text-sm font-medium text-bedi-slate">
            우리의 그림책이 완성됐어요
          </p>
        ) : null}
        <button
          type="button"
          onClick={onOpen}
          disabled={opening}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-bedi-slate px-6 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {opening ? "표지를 펼치는 중…" : "책 펼쳐 보기"}
        </button>
      </div>
    </div>
  );
}

/** Open hardcover: back board, spine gutter and gilded page edges. */
export function OpenBookFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute -inset-x-2 -bottom-2 -top-1 rounded-[22px] bg-[linear-gradient(135deg,#4F6050,#3E4E42)] shadow-[0_28px_54px_-26px_rgba(48,40,28,0.7)]" />
      <div className="absolute -inset-x-1 bottom-0 top-0 rounded-[20px] bg-[#F3EBD9]" />
      {/* page edge stack on the outer side */}
      <div className="pointer-events-none absolute inset-y-2 right-[-1px] w-[7px] rounded-r-[6px] bg-[repeating-linear-gradient(90deg,#EFE5CF_0_1px,#DCCFB4_1px_2px)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** A single leaf of cream paper with gutter shading and a folio number. */
export function PageSurface({
  children,
  folio,
  ornament,
}: {
  children: ReactNode;
  folio?: string;
  ornament?: string;
}) {
  return (
    <div className="relative h-full min-h-[560px] overflow-hidden rounded-[18px] border border-[#E0D5C0] bg-[#FFFCF3] px-5 pb-9 pt-5 shadow-[inset_14px_0_22px_-14px_rgba(104,84,56,0.35),inset_-6px_0_14px_-10px_rgba(104,84,56,0.16)] sm:px-7">
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(#6B5B48_0.6px,transparent_0.6px)] [background-size:6px_6px]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-[linear-gradient(90deg,rgba(104,84,56,0.16),transparent)]" />
      <div className="pointer-events-none absolute inset-x-6 top-2 h-px bg-[#D8CBB4]/50" />

      <div className="relative h-full">{children}</div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-2 text-[10px] tracking-[0.2em] text-[#9C8B72]">
        {ornament ? <span className="text-[#C0AE8F]">{ornament}</span> : null}
        {folio ? <span className="tabular-nums">{folio}</span> : null}
      </div>
    </div>
  );
}
