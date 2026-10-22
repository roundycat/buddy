"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GrowingFlower } from "@/frontend/features/emotion-garden/components/GrowingFlower";
import { MemoryCardSkeleton } from "@/frontend/shared/components/ChildUi";
import { useDialogDismiss } from "@/frontend/shared/hooks/useDialogDismiss";
import { useSoftMotion } from "@/frontend/shared/lib/motion";
import type { FlowerMemoryCard } from "@/frontend/shared/catalogs";
import { formatDateKeyMonthDay } from "@/frontend/shared/lib/date";

interface MemoryFlowerCardProps {
  card: FlowerMemoryCard | null;
  loading?: boolean;
  onClose: () => void;
}

/**
 * Tap a flower → memory of that day.
 * Drawing / voice slots are reserved until those features exist.
 */
export function MemoryFlowerCard({
  card,
  loading,
  onClose,
}: MemoryFlowerCardProps) {
  const open = Boolean(card || loading);
  const { reduced, stagger, item, press } = useSoftMotion();
  useDialogDismiss(open, onClose);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-bedi-slate/30 px-4 pb-6 pt-16 backdrop-blur-[2px] sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label="꽃의 기억"
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-[#FBFAF7] shadow-soft"
            initial={reduced ? { opacity: 0 } : { y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: 28, opacity: 0 }}
            transition={
              reduced
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 260, damping: 26 }
            }
            onClick={(e) => e.stopPropagation()}
          >
            {loading || !card ? (
              <MemoryCardSkeleton />
            ) : (
              <motion.div {...stagger}>
                <motion.div
                  className="flex flex-col items-center px-5 pb-2 pt-6"
                  {...item}
                >
                  <GrowingFlower
                    mood={card.mood}
                    stage={card.stage}
                    size="lg"
                    animateGrow
                  />
                  <p className="mt-3 text-[11px] tracking-wide text-bedi-sage">
                    {formatDateKeyMonthDay(card.plantedOn)}
                  </p>
                  <h3 className="mt-1 text-[17px] font-medium text-bedi-slate">
                    {card.flowerName}
                  </h3>
                  <p className="mt-1 text-sm text-bedi-slate/55">
                    {card.emotionLabel} · {card.note}
                  </p>
                </motion.div>

                <div className="space-y-4 px-5 pb-6 pt-2">
                  <motion.section
                    className="rounded-2xl bg-white/80 px-4 py-3"
                    {...item}
                  >
                    <p className="text-[11px] text-bedi-sage">오늘의 한 문장</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-bedi-slate/75">
                      {card.reflection}
                    </p>
                  </motion.section>

                  {card.adventure.headline || card.adventure.quests.length > 0 ? (
                    <motion.section
                      className="rounded-2xl bg-white/80 px-4 py-3"
                      {...item}
                    >
                      <p className="text-[11px] text-bedi-sage">그날의 모험</p>
                      {card.adventure.headline ? (
                        <p className="mt-1 text-sm font-medium text-bedi-slate">
                          {card.adventure.headline}
                        </p>
                      ) : null}
                      {card.adventure.narrative ? (
                        <p className="mt-1.5 text-sm leading-relaxed text-bedi-slate/65">
                          {card.adventure.narrative}
                        </p>
                      ) : null}
                      {card.adventure.quests.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {card.adventure.quests.map((q, i) => (
                            <li
                              key={`${q.title}-${i}`}
                              className="flex items-center gap-2 text-xs text-bedi-slate/60"
                            >
                              <span>{q.emoji}</span>
                              <span className={q.done ? "" : "opacity-50"}>
                                {q.title}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </motion.section>
                  ) : null}

                  {card.photos.length > 0 ? (
                    <motion.section
                      className="rounded-2xl bg-white/80 px-4 py-3"
                      {...item}
                    >
                      <p className="text-[11px] text-bedi-sage">사진</p>
                      <div className="mt-2 flex gap-2 overflow-x-auto">
                        {card.photos.map((photo) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={photo.id}
                            src={photo.url}
                            alt={photo.caption || "그날의 사진"}
                            className="h-20 w-20 shrink-0 rounded-xl object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ))}
                      </div>
                    </motion.section>
                  ) : null}

                  {card.conversationSummaries.length > 0 ? (
                    <motion.section
                      className="rounded-2xl bg-white/80 px-4 py-3"
                      {...item}
                    >
                      <p className="text-[11px] text-bedi-sage">대화의 결</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {card.conversationSummaries.map((s, i) => (
                          <li
                            key={i}
                            className="text-sm leading-relaxed text-bedi-slate/65"
                          >
                            {s}
                          </li>
                        ))}
                      </ul>
                    </motion.section>
                  ) : null}

                  <motion.div className="grid grid-cols-2 gap-2" {...item}>
                    <div className="rounded-2xl border border-dashed border-bedi-slate/15 px-3 py-3 text-center">
                      <p className="text-[11px] text-bedi-slate/35">그림</p>
                      <p className="mt-1 text-xs text-bedi-slate/30">곧 열려요</p>
                    </div>
                    <div className="rounded-2xl border border-dashed border-bedi-slate/15 px-3 py-3 text-center">
                      <p className="text-[11px] text-bedi-slate/35">목소리</p>
                      <p className="mt-1 text-xs text-bedi-slate/30">곧 열려요</p>
                    </div>
                  </motion.div>

                  <motion.button
                    type="button"
                    onClick={onClose}
                    className="h-12 w-full rounded-2xl bg-bedi-slate text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bedi-sage/50 focus-visible:ring-offset-2"
                    {...item}
                    {...press}
                  >
                    정원으로
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
