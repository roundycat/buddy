"use client";

import type { CSSProperties } from "react";
import { cn } from "@/frontend/shared/lib/utils";
import type {
  GrowthStage,
  MoodId,
} from "@/frontend/shared/catalogs";
import { FLOWER_CATALOG } from "@/frontend/shared/catalogs";

interface GrowingFlowerProps {
  mood: MoodId;
  stage?: GrowthStage;
  label?: string;
  animateGrow?: boolean;
  sway?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  /** Draw the little soil ellipse under the plant (hero plot draws its own) */
  showSoil?: boolean;
  className?: string;
  title?: string;
  style?: CSSProperties;
}

const SIZE = {
  sm: 56,
  md: 72,
  lg: 112,
  xl: 168,
} as const;

/**
 * Soft pastel flower drawn as SVG for each growth stage.
 * Seed starts nestled in soil and grows upward — every feeling stays beautiful.
 */
export function GrowingFlower({
  mood,
  stage = "bloom",
  label,
  animateGrow = false,
  sway = true,
  size = "sm",
  showSoil = true,
  className,
  title,
  style,
}: GrowingFlowerProps) {
  const species = FLOWER_CATALOG[mood] ?? FLOWER_CATALOG.calm;
  const px = SIZE[size];
  const { palette: p } = species;
  const isHero = size === "xl" || size === "lg";

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
          "relative origin-bottom",
          sway && !animateGrow && "garden-flower-sway",
          animateGrow && "garden-flower-sway-late"
        )}
        style={{ width: px, height: px }}
      >
        <svg
          viewBox="0 0 80 80"
          width={px}
          height={px}
          aria-hidden
          className="overflow-visible"
        >
          {stage === "bloom" ? (
            <circle cx="40" cy="34" r="22" fill={p.glow} />
          ) : null}

          {showSoil ? (
            <>
              <ellipse cx="40" cy="72" rx="20" ry="6" fill={p.soil} opacity="0.5" />
              <ellipse cx="40" cy="70" rx="12" ry="3.5" fill="#5C4029" opacity="0.35" />
            </>
          ) : null}

          {stage === "seed" ? (
            <g className={animateGrow ? "garden-seed-drop" : undefined}>
              {/* seed nestled in a little crater */}
              <ellipse cx="40" cy="68" rx="9" ry="4" fill="#4A3420" opacity="0.45" />
              <ellipse
                cx="40"
                cy="64"
                rx={isHero ? 7 : 5.5}
                ry={isHero ? 5 : 3.8}
                fill="#5C3D24"
              />
              <ellipse
                cx="38.5"
                cy="62.5"
                rx={isHero ? 3 : 2.2}
                ry={isHero ? 2 : 1.4}
                fill="#8B6914"
                opacity="0.55"
              />
            </g>
          ) : null}

          {stage !== "seed" ? (
            <>
              <path
                d={
                  stage === "sprout"
                    ? "M40 70 Q40 55 40 44"
                    : stage === "bud"
                      ? "M40 70 Q39 50 40 32"
                      : "M40 70 Q38 48 40 26"
                }
                stroke={p.leaf}
                strokeWidth={isHero ? 3 : 2.4}
                fill="none"
                strokeLinecap="round"
                className={animateGrow ? "garden-stem-anim" : undefined}
              />
              <path
                d="M40 58 Q28 52 24 46"
                stroke={p.leaf}
                strokeWidth={isHero ? 2.4 : 2}
                fill="none"
                strokeLinecap="round"
                opacity="0.85"
                className={animateGrow ? "garden-leaf-anim" : undefined}
              />
              {stage !== "sprout" ? (
                <path
                  d="M40 52 Q52 46 56 40"
                  stroke={p.leaf}
                  strokeWidth={isHero ? 2.4 : 2}
                  fill="none"
                  strokeLinecap="round"
                  opacity="0.8"
                />
              ) : null}
            </>
          ) : null}

          {stage === "sprout" ? (
            <ellipse
              cx="40"
              cy="42"
              rx={isHero ? 9 : 7}
              ry={isHero ? 6 : 5}
              fill={p.leaf}
              transform="rotate(-18 40 42)"
              className={animateGrow ? "garden-leaf-anim" : undefined}
            />
          ) : null}

          {stage === "bud" ? (
            <ellipse
              cx="40"
              cy="28"
              rx={isHero ? 9 : 7}
              ry={isHero ? 13 : 10}
              fill={p.petal}
              stroke={p.petalDeep}
              strokeWidth="1"
              className={animateGrow ? "garden-bud-swell" : undefined}
            />
          ) : null}

          {stage === "bloom" ? <BloomHead mood={mood} /> : null}
        </svg>
      </div>

      {label ? (
        <span className="mt-0.5 max-w-full truncate text-[9px] text-bedi-slate/45">
          {label}
        </span>
      ) : null}
    </div>
  );
}

function BloomHead({ mood }: { mood: MoodId }) {
  const p = (FLOWER_CATALOG[mood] ?? FLOWER_CATALOG.calm).palette;

  switch (mood) {
    case "happy":
      // Sunflower
      return (
        <g className="garden-bloom-head-anim">
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const x = 40 + Math.cos(a) * 14;
            const y = 30 + Math.sin(a) * 14;
            return (
              <ellipse
                key={i}
                cx={x}
                cy={y}
                rx="5"
                ry="9"
                fill={p.petal}
                stroke={p.petalDeep}
                strokeWidth="0.5"
                transform={`rotate(${i * 30} ${x} ${y})`}
              />
            );
          })}
          <circle cx="40" cy="30" r="8" fill={p.center} />
        </g>
      );
    case "brave":
      // Tulip
      return (
        <g className="garden-bloom-head-anim">
          <path
            d="M28 38 Q28 18 40 14 Q52 18 52 38 Q46 34 40 38 Q34 34 28 38Z"
            fill={p.petal}
            stroke={p.petalDeep}
            strokeWidth="0.8"
          />
          <path d="M40 38 L40 14" stroke={p.petalDeep} strokeWidth="0.6" opacity="0.4" />
        </g>
      );
    case "hope":
      // Daisy
      return (
        <g className="garden-bloom-head-anim">
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i * 36 * Math.PI) / 180;
            return (
              <ellipse
                key={i}
                cx={40 + Math.cos(a) * 11}
                cy={30 + Math.sin(a) * 11}
                rx="4"
                ry="8"
                fill={p.petal}
                stroke={p.petalDeep}
                strokeWidth="0.4"
                transform={`rotate(${i * 36} ${40 + Math.cos(a) * 11} ${30 + Math.sin(a) * 11})`}
              />
            );
          })}
          <circle cx="40" cy="30" r="6" fill={p.center} />
        </g>
      );
    case "calm":
      // Hydrangea cluster
      return (
        <g className="garden-bloom-head-anim">
          {[
            [40, 24],
            [32, 30],
            [48, 30],
            [36, 36],
            [44, 36],
            [40, 32],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i === 5 ? 5 : 6}
              fill={i % 2 === 0 ? p.petal : p.petalDeep}
              opacity="0.9"
            />
          ))}
        </g>
      );
    case "love":
      // Cherry blossom
      return (
        <g className="garden-bloom-head-anim">
          {Array.from({ length: 5 }).map((_, i) => {
            const a = ((i * 72 - 90) * Math.PI) / 180;
            const x = 40 + Math.cos(a) * 10;
            const y = 30 + Math.sin(a) * 10;
            return (
              <ellipse
                key={i}
                cx={x}
                cy={y}
                rx="7"
                ry="5"
                fill={p.petal}
                stroke={p.petalDeep}
                strokeWidth="0.5"
                transform={`rotate(${i * 72} ${x} ${y})`}
              />
            );
          })}
          <circle cx="40" cy="30" r="3.5" fill={p.center} />
        </g>
      );
    case "sleepy":
      // Lavender spikes
      return (
        <g className="garden-bloom-head-anim">
          {[0, -7, 7].map((dx, i) => (
            <g key={i}>
              {[18, 24, 30, 36].map((cy, j) => (
                <ellipse
                  key={j}
                  cx={40 + dx}
                  cy={cy}
                  rx="3.2"
                  ry="4"
                  fill={j % 2 === 0 ? p.petal : p.petalDeep}
                />
              ))}
            </g>
          ))}
        </g>
      );
    case "sad":
      // Bluebell drooping
      return (
        <g className="garden-bloom-head-anim">
          <path
            d="M34 22 Q40 18 46 22 Q50 34 40 40 Q30 34 34 22Z"
            fill={p.petal}
            stroke={p.petalDeep}
            strokeWidth="0.7"
          />
          <ellipse cx="40" cy="38" rx="5" ry="2.5" fill={p.petalDeep} opacity="0.5" />
        </g>
      );
    case "lonely":
      // Forget-me-not
      return (
        <g className="garden-bloom-head-anim">
          {Array.from({ length: 5 }).map((_, i) => {
            const a = ((i * 72 - 90) * Math.PI) / 180;
            return (
              <circle
                key={i}
                cx={40 + Math.cos(a) * 8}
                cy={30 + Math.sin(a) * 8}
                r="5"
                fill={p.petal}
                stroke={p.petalDeep}
                strokeWidth="0.4"
              />
            );
          })}
          <circle cx="40" cy="30" r="3" fill={p.center} />
        </g>
      );
    case "angry":
      // Red poppy
      return (
        <g className="garden-bloom-head-anim">
          {Array.from({ length: 4 }).map((_, i) => {
            const a = ((i * 90 + 45) * Math.PI) / 180;
            return (
              <ellipse
                key={i}
                cx={40 + Math.cos(a) * 9}
                cy={30 + Math.sin(a) * 9}
                rx="10"
                ry="7"
                fill={p.petal}
                stroke={p.petalDeep}
                strokeWidth="0.5"
                transform={`rotate(${i * 90 + 45} ${40 + Math.cos(a) * 9} ${30 + Math.sin(a) * 9})`}
              />
            );
          })}
          <circle cx="40" cy="30" r="4.5" fill={p.center} />
        </g>
      );
    default:
      return <circle cx="40" cy="30" r="10" fill={p.petal} />;
  }
}
