"use client";

import { cn } from "@/frontend/shared/lib/utils";
import type {
  SkyPhase,
  TreeSeason,
  TreeSky,
} from "@/frontend/shared/catalogs";

interface TreeAmbienceProps {
  sky: TreeSky;
  season: TreeSeason;
  leafCount: number;
}

const SKY_GRADIENT: Record<SkyPhase, Record<string, string>> = {
  dawn: {
    sunny: "linear-gradient(180deg, #FBDCC0 0%, #F8EBDA 48%, #EEF3E8 100%)",
    cloudy: "linear-gradient(180deg, #E8DAD0 0%, #F1E9E1 48%, #EAF0E6 100%)",
    rainy: "linear-gradient(180deg, #CFCCCA 0%, #DFDCD8 48%, #E2E9DE 100%)",
  },
  day: {
    sunny: "linear-gradient(180deg, #C2E6F7 0%, #E2F2F5 48%, #EDF3E8 100%)",
    cloudy: "linear-gradient(180deg, #D2DDE3 0%, #E4EAE9 48%, #E8EDE5 100%)",
    rainy: "linear-gradient(180deg, #B2BFC9 0%, #CDD7D6 48%, #DFE6DC 100%)",
  },
  dusk: {
    sunny: "linear-gradient(180deg, #F6C39C 0%, #EFD1BC 48%, #E2E8DC 100%)",
    cloudy: "linear-gradient(180deg, #CDB6AB 0%, #DCCFC6 48%, #E0E6DA 100%)",
    rainy: "linear-gradient(180deg, #A3A3AE 0%, #C0C1C1 48%, #D8E0D5 100%)",
  },
  night: {
    sunny: "linear-gradient(180deg, #253453 0%, #37485F 48%, #4C5C57 100%)",
    cloudy: "linear-gradient(180deg, #293145 0%, #3D4756 48%, #495651 100%)",
    rainy: "linear-gradient(180deg, #1F2637 0%, #333D4B 48%, #434F4C 100%)",
  },
};

const PHASE_LABEL: Record<SkyPhase, string> = {
  dawn: "이른 아침",
  day: "낮",
  dusk: "해질 무렵",
  night: "밤",
};

const SEASON_LABEL: Record<TreeSeason, string> = {
  spring: "봄",
  summer: "여름",
  autumn: "가을",
  winter: "겨울",
};

/** What drifts through the air this season. */
const DRIFT: Record<TreeSeason, { color: string; count: number } | null> = {
  spring: { color: "#F8C8D8", count: 7 },
  summer: null,
  autumn: { color: "#E8B87A", count: 6 },
  winter: { color: "#FFFFFF", count: 9 },
};

/**
 * The world around the tree — light, weather, season and small visitors.
 * Pure ambience. Nothing here can be collected or scored.
 */
export function TreeAmbience({ sky, season, leafCount }: TreeAmbienceProps) {
  const { phase, weather } = sky;
  const isNight = phase === "night";
  const isRaining = weather === "rainy";
  const showSun = !isNight && weather === "sunny";
  const showClouds = weather !== "sunny" || phase === "dawn";
  const showButterfly = leafCount > 0 && !isNight && !isRaining;
  const showBird = leafCount >= 6 && !isNight && !isRaining;
  const drift = isNight || isRaining ? null : DRIFT[season];

  return (
    <>
      <div
        className="absolute inset-0 transition-[background] duration-1000"
        style={{ background: SKY_GRADIENT[phase][weather] }}
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {showSun ? (
          <>
            <span className="tree-sun absolute right-8 top-6 h-12 w-12 rounded-full bg-amber-200/90 blur-[2px]" />
            {/* morning light falling across the room */}
            <span className="tree-sunbeam absolute -right-6 top-0 h-full w-32 bg-gradient-to-bl from-amber-100/45 to-transparent" />
          </>
        ) : null}

        {isNight ? (
          <>
            <span className="absolute right-9 top-6 h-9 w-9 rounded-full bg-[#F5F1DC]/85 shadow-[0_0_22px_rgba(245,241,220,0.4)]" />
            {[
              { left: "14%", top: "58%", delay: "0s" },
              { left: "31%", top: "34%", delay: "1.4s" },
              { left: "48%", top: "66%", delay: "2.9s" },
              { left: "67%", top: "42%", delay: "4.1s" },
              { left: "82%", top: "70%", delay: "5.3s" },
              { left: "22%", top: "78%", delay: "6.2s" },
            ].map((f, i) => (
              <span
                key={`firefly-${i}`}
                className="tree-firefly absolute h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_9px_rgba(253,230,138,0.9)]"
                style={{ left: f.left, top: f.top, animationDelay: f.delay }}
              />
            ))}
          </>
        ) : null}

        {showClouds
          ? [
              { top: "12%", scale: 1, delay: "0s", opacity: 0.7 },
              { top: "30%", scale: 0.66, delay: "-16s", opacity: 0.5 },
            ].map((c, i) => (
              <span
                key={`cloud-${i}`}
                className="tree-cloud absolute h-6 w-20 rounded-full bg-white"
                style={{
                  top: c.top,
                  opacity: c.opacity,
                  transform: `scale(${c.scale})`,
                  animationDelay: c.delay,
                }}
              />
            ))
          : null}

        {isRaining
          ? Array.from({ length: 18 }).map((_, i) => (
              <span
                key={`rain-${i}`}
                className="tree-raindrop absolute h-4 w-px rounded-full bg-white/65"
                style={{
                  left: `${(i * 11 + 3) % 97}%`,
                  animationDelay: `${(i % 9) * 0.17}s`,
                }}
              />
            ))
          : null}

        {drift
          ? Array.from({ length: drift.count }).map((_, i) => (
              <span
                key={`drift-${i}`}
                className="tree-drift absolute h-1.5 w-1.5 rounded-full"
                style={{
                  left: `${(i * 13 + 6) % 92}%`,
                  background: drift.color,
                  opacity: 0.75,
                  animationDelay: `${i * 1.3}s`,
                  animationDuration: `${9 + (i % 4) * 2}s`,
                }}
              />
            ))
          : null}

        {showButterfly ? (
          <span className="tree-butterfly absolute left-[24%] top-[46%] text-lg">
            🦋
          </span>
        ) : null}

        {showBird ? (
          <span className="tree-bird absolute right-[22%] top-[26%] text-base">
            🐦
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "absolute left-4 top-3 rounded-full px-2.5 py-1 text-[10px] backdrop-blur-sm",
          isNight ? "bg-white/15 text-white/85" : "bg-white/55 text-bedi-slate/70"
        )}
      >
        {SEASON_LABEL[season]} · {PHASE_LABEL[phase]} · {sky.weatherLabel}
        {sky.tempC !== null ? ` ${sky.tempC}°` : ""}
      </div>
    </>
  );
}
