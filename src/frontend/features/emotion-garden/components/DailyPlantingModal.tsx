"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDialogDismiss } from "@/frontend/shared/hooks/useDialogDismiss";
import { EmotionSeed } from "@/frontend/features/emotion-garden/components/EmotionSeed";
import { GrowingFlower } from "@/frontend/features/emotion-garden/components/GrowingFlower";
import type {
  EmotionSeedSuggestion,
  MoodId,
  MoodOption,
} from "@/frontend/shared/catalogs";
import { FLOWER_CATALOG } from "@/frontend/shared/catalogs";

interface DailyPlantingModalProps {
  open: boolean;
  moods: MoodOption[];
  suggestion: EmotionSeedSuggestion | null;
  busy: boolean;
  onClose: () => void;
  onPlant: (mood: MoodId) => void;
}

/**
 * Suggest → confirm → plant. Child may accept the AI seed or pick another.
 */
export function DailyPlantingModal({
  open,
  moods,
  suggestion,
  busy,
  onClose,
  onPlant,
}: DailyPlantingModalProps) {
  const [picked, setPicked] = useState<MoodId | null>(null);

  useDialogDismiss(open, onClose);

  useEffect(() => {
    if (open) setPicked(null);
  }, [open, suggestion?.mood]);

  const active = picked ?? suggestion?.mood ?? null;
  const species = active ? FLOWER_CATALOG[active] : null;
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-bedi-slate/25 px-4 pb-6 pt-16 backdrop-blur-[2px] sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label="오늘의 감정 씨앗"
            className="w-full max-w-md overflow-hidden rounded-3xl bg-[#FBFAF7] shadow-soft"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pb-2 pt-5 text-center">
              <p className="text-[11px] tracking-wide text-bedi-sage">
                오늘의 감정 씨앗
              </p>
              <h3 className="mt-1 text-[17px] font-medium text-bedi-slate">
                어떤 마음이 자랄까요?
              </h3>
              {suggestion ? (
                <p className="mt-2 text-sm leading-relaxed text-bedi-slate/65">
                  {suggestion.reason}
                </p>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-bedi-slate/65">
                  모든 감정은 아름다운 꽃이 돼요.
                </p>
              )}
            </div>

            {species ? (
              <div className="flex justify-center py-3">
                <GrowingFlower mood={species.id} stage="seed" size="lg" sway={false} />
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-2 px-4 pb-2">
              {moods.map((mood) => (
                <EmotionSeed
                  key={mood.id}
                  mood={mood.id}
                  selected={active === mood.id}
                  onSelect={() => setPicked(mood.id)}
                />
              ))}
            </div>

            <div className="flex gap-2 px-4 pb-5 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="h-12 flex-1 rounded-2xl border border-bedi-slate/10 text-sm text-bedi-slate/60 transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/40"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={!active || busy}
                onClick={() => active && onPlant(active)}
                className="h-12 flex-[1.4] rounded-2xl bg-bedi-slate text-sm font-medium text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/50 focus-visible:ring-offset-2"
              >
                {busy ? "심는 중…" : "씨앗 심기"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
