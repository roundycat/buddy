"use client";

import { motion } from "framer-motion";
import { Droplets } from "lucide-react";
import { cn } from "@/frontend/shared/lib/utils";
import { GardenAnimation } from "@/frontend/features/emotion-garden/components/GardenAnimation";
import { GrowingFlower } from "@/frontend/features/emotion-garden/components/GrowingFlower";
import type {
  EmotionGardenResponse,
  GardenPlantView,
  SkyPhase,
} from "@/frontend/shared/catalogs";

interface GardenMapProps {
  garden: EmotionGardenResponse;
  phase: SkyPhase;
  growingId: string | null;
  wateringId: string | null;
  busy: boolean;
  onSelectPlant: (plant: GardenPlantView) => void;
  onOpenPlanting: () => void;
  onWater: (plant: GardenPlantView) => void;
  onOpenMemory: (plant: GardenPlantView) => void;
}

/**
 * One day, one plant. The hero is today's seed in the soil;
 * earlier blooms sit quietly in a small row beneath.
 */
export function GardenMap({
  garden,
  phase,
  growingId,
  wateringId,
  busy,
  onOpenPlanting,
  onWater,
  onOpenMemory,
}: GardenMapProps) {
  const isNight = phase === "night";
  const today =
    garden.flowers.find((f) => f.plantedOn === garden.todayDate) ?? null;
  const stageHint = today
    ? today.stage === "seed"
      ? "흙 속에 씨앗이 있어요. 물을 주면 고개를 들어요."
      : today.stage === "sprout"
        ? "새싹이 나왔어요. 한 번 더 물을 주세요."
        : today.stage === "bud"
          ? today.adventureComplete
            ? "곧 활짝 필 거예요."
            : "꽃봉오리가 맺혔어요. 모험을 마치거나 물을 주면 펴요."
          : "활짝 피었어요. 눌러서 오늘 기억을 볼 수 있어요."
    : "빈 흙에 오늘의 감정 씨앗을 심어 보세요.";

  return (
    <div className="overflow-hidden rounded-3xl border border-bedi-sage/20 shadow-softer">
      <GardenAnimation
        sky={garden.sky}
        phaseOverride={phase}
        bloomedCount={garden.bloomedCount}
      />

      <div
        className="relative px-5 pb-5 pt-6 transition-[background] duration-1000"
        style={{
          background: isNight
            ? "linear-gradient(180deg, #4A5A55 0%, #3E4C48 100%)"
            : "linear-gradient(180deg, #E8F0E4 0%, #D4E4CC 100%)",
        }}
      >
        <p
          className={cn(
            "mb-4 text-center text-[13px] leading-relaxed",
            isNight ? "text-white/70" : "text-bedi-slate/60"
          )}
        >
          {today
            ? `${today.flowerName} · ${today.stageLabel}`
            : "오늘의 자리"}
        </p>

        {/* Hero soil plot — single focus */}
        <div className="relative mx-auto flex max-w-[280px] flex-col items-center">
          {/* soft soil bowl */}
          <div
            className="relative flex w-full flex-col items-center justify-end overflow-hidden rounded-[40%] px-4 pb-8 pt-10"
            style={{
              minHeight: 220,
              background: isNight
                ? "radial-gradient(ellipse at 50% 70%, rgba(92,64,41,0.55) 0%, rgba(62,76,72,0.2) 70%)"
                : "radial-gradient(ellipse at 50% 70%, rgba(168,132,90,0.45) 0%, rgba(220,232,214,0.15) 72%)",
            }}
          >
            {/* soil surface ring */}
            <div
              className="pointer-events-none absolute bottom-6 left-1/2 h-16 w-[85%] -translate-x-1/2 rounded-[100%]"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(120,84,54,0.55) 0%, rgba(120,84,54,0.15) 55%, transparent 70%)",
              }}
              aria-hidden
            />

            {wateringId ? (
              <span
                className="garden-mood-drop pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 text-2xl"
                aria-hidden
              >
                💧
              </span>
            ) : null}

            {today ? (
              <motion.button
                type="button"
                layout
                whileTap={{ scale: 0.97 }}
                onClick={() =>
                  today.stage === "bloom"
                    ? onOpenMemory(today)
                    : today.canWater
                      ? onWater(today)
                      : onOpenMemory(today)
                }
                className="relative z-10 flex flex-col items-center"
                aria-label={
                  today.canWater
                    ? `${today.flowerName}에 물 주기`
                    : `${today.flowerName} 기억 보기`
                }
              >
                <GrowingFlower
                  mood={today.mood}
                  stage={today.stage}
                  size="xl"
                  animateGrow={growingId === today.id}
                  sway={growingId !== today.id}
                  showSoil={false}
                />
              </motion.button>
            ) : garden.canPlantToday ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={onOpenPlanting}
                className="relative z-10 flex flex-col items-center gap-3 py-6"
                aria-label="오늘의 씨앗 심기"
              >
                {/* empty crater waiting for a seed */}
                <span
                  className="relative flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 40%, #5C4029 0%, #8B6914 45%, transparent 70%)",
                    boxShadow: "inset 0 4px 10px rgba(0,0,0,0.25)",
                  }}
                >
                  <span className="h-3 w-4 rounded-full bg-[#3D2A1A]/40" />
                </span>
                <span
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px] font-medium",
                    isNight
                      ? "bg-white/15 text-white/85"
                      : "bg-white/70 text-bedi-sage"
                  )}
                >
                  씨앗 심기
                </span>
              </motion.button>
            ) : (
              <p
                className={cn(
                  "relative z-10 py-10 text-center text-sm",
                  isNight ? "text-white/55" : "text-bedi-slate/45"
                )}
              >
                오늘은 쉬는 흙이에요
              </p>
            )}
          </div>

          <p
            className={cn(
              "mt-3 text-center text-xs leading-relaxed",
              isNight ? "text-white/55" : "text-bedi-slate/50"
            )}
          >
            {stageHint}
          </p>

          {today?.canWater ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onWater(today)}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-sky-500/90 text-sm font-medium text-white shadow-softer transition-colors hover:bg-sky-500 disabled:opacity-40"
            >
              <Droplets className="h-4 w-4" strokeWidth={1.75} />
              물 주기
            </button>
          ) : null}

          {today && today.stage === "bloom" ? (
            <button
              type="button"
              onClick={() => onOpenMemory(today)}
              className={cn(
                "mt-4 h-12 w-full rounded-2xl text-sm font-medium transition-colors",
                isNight
                  ? "bg-white/15 text-white hover:bg-white/25"
                  : "bg-bedi-slate text-white hover:bg-bedi-slate/90"
              )}
            >
              오늘의 기억 보기
            </button>
          ) : null}

          {/* growth steps — quiet, not a score */}
          {today ? (
            <div className="mt-4 flex w-full items-center justify-between gap-1 px-1">
              {(
                [
                  ["seed", "씨앗"],
                  ["sprout", "새싹"],
                  ["bud", "봉오리"],
                  ["bloom", "꽃"],
                ] as const
              ).map(([id, label], i) => {
                const order = ["seed", "sprout", "bud", "bloom"] as const;
                const current = order.indexOf(today.stage);
                const reached = i <= current;
                return (
                  <div key={id} className="flex flex-1 flex-col items-center gap-1">
                    <span
                      className={cn(
                        "h-1.5 w-full rounded-full transition-colors duration-700",
                        reached
                          ? isNight
                            ? "bg-amber-200/70"
                            : "bg-bedi-sage/70"
                          : isNight
                            ? "bg-white/15"
                            : "bg-bedi-slate/10"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[9px]",
                        reached
                          ? isNight
                            ? "text-white/70"
                            : "text-bedi-slate/55"
                          : isNight
                            ? "text-white/30"
                            : "text-bedi-slate/30"
                      )}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
}
