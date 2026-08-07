"use client";

import { motion } from "framer-motion";
import type { MoodId } from "@/frontend/shared/catalogs";
import { FLOWER_CATALOG } from "@/frontend/shared/catalogs";
import { cn } from "@/frontend/shared/lib/utils";

interface EmotionSeedProps {
  mood: MoodId;
  selected?: boolean;
  onSelect?: () => void;
  draggable?: boolean;
  className?: string;
}

/**
 * Today's emotion seed — soft, large touch target.
 */
export function EmotionSeed({
  mood,
  selected,
  onSelect,
  className,
}: EmotionSeedProps) {
  const species = FLOWER_CATALOG[mood] ?? FLOWER_CATALOG.calm;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      onClick={onSelect}
      aria-label={`${species.emotionLabel} 씨앗`}
      className={cn(
        "flex min-h-[72px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 transition-colors",
        selected
          ? "border-bedi-sage/45 bg-bedi-sage/15"
          : "border-bedi-slate/10 bg-[#FBFAF7] hover:border-bedi-sage/25 hover:bg-white",
        className
      )}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full shadow-sm"
        style={{ background: species.palette.glow }}
      >
        <span
          className="h-3.5 w-3.5 rounded-full"
          style={{ background: species.palette.petalDeep }}
        />
      </span>
      <span className="text-[10px] font-medium text-bedi-slate/70">
        {species.emotionLabel}
      </span>
      <span className="text-[9px] text-bedi-slate/40">{species.flowerName}</span>
    </motion.button>
  );
}
