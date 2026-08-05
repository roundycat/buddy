"use client";

import type { CSSProperties } from "react";
import { cn } from "@/frontend/shared/lib/utils";
import type { MoodId } from "@/backend/features/emotion-garden/emotion-garden.types";

const stemTone: Record<MoodId, string> = {
  happy: "bg-emerald-500/70",
  sad: "bg-teal-600/55",
  sleepy: "bg-indigo-400/55",
  angry: "bg-lime-600/60",
  love: "bg-emerald-500/65",
};

interface GrowingFlowerProps {
  emoji: string;
  mood: MoodId;
  label?: string;
  /** Full seed→bloom sequence (new plant) */
  animateGrow?: boolean;
  /** Soft sway after grown */
  sway?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
  style?: CSSProperties;
}

/**
 * Visual flower with optional grow-from-soil motion.
 */
export function GrowingFlower({
  emoji,
  mood,
  label,
  animateGrow = false,
  sway = true,
  size = "sm",
  className,
  title,
  style,
}: GrowingFlowerProps) {
  const dims =
    size === "lg"
      ? { stem: "h-14 w-1.5", bloom: "text-[42px]", pot: "w-10" }
      : size === "md"
        ? { stem: "h-10 w-1", bloom: "text-[32px]", pot: "w-8" }
        : { stem: "h-7 w-0.5", bloom: "text-[26px]", pot: "w-6" };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-end",
        animateGrow && "garden-plant-grow",
        className
      )}
      title={title}
      style={style}
    >
      <div
        className={cn(
          "relative flex flex-col items-center",
          sway && !animateGrow && "garden-flower-sway",
          animateGrow && "garden-flower-sway-late"
        )}
      >
        <span
          className={cn(
            "garden-bloom-head relative z-10 origin-bottom leading-none drop-shadow-sm",
            dims.bloom,
            animateGrow && "garden-bloom-head-anim"
          )}
          aria-hidden
        >
          {emoji}
        </span>

        <span
          className={cn(
            "garden-leaf garden-leaf-l absolute left-1/2 top-[55%] h-2.5 w-3 -translate-x-[140%] rounded-[100%] bg-emerald-500/45",
            animateGrow && "garden-leaf-anim"
          )}
          aria-hidden
        />
        <span
          className={cn(
            "garden-leaf garden-leaf-r absolute left-1/2 top-[62%] h-2.5 w-3 translate-x-[40%] rounded-[100%] bg-emerald-600/40",
            animateGrow && "garden-leaf-anim"
          )}
          aria-hidden
        />

        <span
          className={cn(
            "garden-stem origin-bottom rounded-full",
            dims.stem,
            stemTone[mood],
            animateGrow && "garden-stem-anim"
          )}
          aria-hidden
        />
      </div>

      <span
        className={cn(
          "garden-soil mt-0.5 h-2 rounded-full bg-amber-900/20",
          dims.pot,
          animateGrow && "garden-soil-anim"
        )}
        aria-hidden
      />

      {label ? (
        <span className="mt-1 max-w-full truncate text-[9px] text-bedi-slate/45">
          {label}
        </span>
      ) : null}
    </div>
  );
}
