"use client";

import { cn } from "@/frontend/shared/lib/utils";
import type {
  GardenSky as GardenSkyData,
  SkyPhase,
} from "@/frontend/shared/catalogs";

const SKY_GRADIENT: Record<SkyPhase, Record<string, string>> = {
  dawn: {
    sunny: "linear-gradient(180deg, #FBD8B8 0%, #F6E7D2 55%, #EAF1E5 100%)",
    cloudy: "linear-gradient(180deg, #E4D5CB 0%, #EFE6DC 55%, #E7EEE3 100%)",
    rainy: "linear-gradient(180deg, #C9C6C6 0%, #DCD9D4 55%, #DFE7DB 100%)",
  },
  day: {
    sunny: "linear-gradient(180deg, #B8E1F5 0%, #DCEFF3 55%, #E8F0E4 100%)",
    cloudy: "linear-gradient(180deg, #CBD8DF 0%, #DFE7E6 55%, #E4EAE2 100%)",
    rainy: "linear-gradient(180deg, #A9B7C3 0%, #C8D3D3 55%, #DBE3D9 100%)",
  },
  dusk: {
    sunny: "linear-gradient(180deg, #F3B98F 0%, #EBC9B4 55%, #DEE5D9 100%)",
    cloudy: "linear-gradient(180deg, #C7AFA5 0%, #D8C9C0 55%, #DCE3D7 100%)",
    rainy: "linear-gradient(180deg, #9A9AA6 0%, #BBBCBC 55%, #D5DDD2 100%)",
  },
  night: {
    sunny: "linear-gradient(180deg, #223050 0%, #34455C 55%, #4A5A55 100%)",
    cloudy: "linear-gradient(180deg, #262E42 0%, #3A4453 55%, #47544F 100%)",
    rainy: "linear-gradient(180deg, #1D2434 0%, #303A48 55%, #414D4A 100%)",
  },
};

const PHASE_LABEL: Record<SkyPhase, string> = {
  dawn: "이른 아침",
  day: "낮",
  dusk: "해질 무렵",
  night: "밤",
};

interface GardenAnimationProps {
  sky: GardenSkyData;
  phaseOverride?: SkyPhase | null;
  bloomedCount: number;
}

/**
 * Living sky strip — weather, time of day, butterflies and fireflies.
 * Pure ambience: no collectibles, no rewards.
 */
export function GardenAnimation({
  sky,
  phaseOverride,
  bloomedCount,
}: GardenAnimationProps) {
  const phase = phaseOverride ?? sky.phase;
  const weather = sky.weather;
  const isNight = phase === "night";
  const showSun = !isNight && weather === "sunny";
  const showClouds = weather !== "sunny" || phase === "dawn";
  const showRain = weather === "rainy";
  const showButterfly = bloomedCount > 0 && !isNight && !showRain;

  return (
    <div
      className="relative h-28 w-full overflow-hidden transition-[background] duration-1000"
      style={{ background: SKY_GRADIENT[phase][weather] }}
      aria-hidden
    >
      {showSun ? (
        <span className="garden-sun absolute right-6 top-4 h-10 w-10 rounded-full bg-amber-200 blur-[1px]" />
      ) : null}

      {isNight ? (
        <>
          <span className="absolute right-7 top-4 h-8 w-8 rounded-full bg-[#F3EFD8]/85 shadow-[0_0_18px_rgba(243,239,216,0.45)]" />
          {[
            { left: "12%", top: "22%", delay: "0s" },
            { left: "34%", top: "56%", delay: "1.6s" },
            { left: "62%", top: "34%", delay: "3.1s" },
            { left: "80%", top: "62%", delay: "4.4s" },
          ].map((f, i) => (
            <span
              key={`firefly-${i}`}
              className="garden-firefly absolute h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_8px_rgba(253,230,138,0.9)]"
              style={{ left: f.left, top: f.top, animationDelay: f.delay }}
            />
          ))}
        </>
      ) : null}

      {showClouds
        ? [
            { top: "18%", scale: 1, delay: "0s", opacity: 0.75 },
            { top: "46%", scale: 0.7, delay: "-13s", opacity: 0.55 },
          ].map((c, i) => (
            <span
              key={`cloud-${i}`}
              className="garden-cloud absolute h-5 w-14 rounded-full bg-white"
              style={{
                top: c.top,
                opacity: c.opacity,
                transform: `scale(${c.scale})`,
                animationDelay: c.delay,
              }}
            />
          ))
        : null}

      {showRain
        ? Array.from({ length: 14 }).map((_, i) => (
            <span
              key={`rain-${i}`}
              className="garden-raindrop absolute h-3 w-px rounded-full bg-white/70"
              style={{
                left: `${(i * 7 + 4) % 96}%`,
                top: `${(i % 4) * 18}%`,
                animationDelay: `${(i % 7) * 0.16}s`,
              }}
            />
          ))
        : null}

      {showButterfly ? (
        <span className="garden-visitor absolute left-[42%] top-[40%] text-xl">
          🦋
        </span>
      ) : null}

      <div
        className={cn(
          "absolute left-4 top-3 rounded-full px-2.5 py-1 text-[10px] backdrop-blur-sm",
          isNight ? "bg-white/15 text-white/85" : "bg-white/55 text-bedi-slate/70"
        )}
      >
        {PHASE_LABEL[phase]} · {sky.weatherLabel}
        {sky.tempC !== null ? ` ${sky.tempC}°` : ""}
      </div>
    </div>
  );
}
