"use client";

import type { RefObject } from "react";
import { motion } from "framer-motion";
import { cn } from "@/frontend/shared/lib/utils";
import { WishLeaf } from "@/frontend/features/wish-tree/components/WishLeaf";
import { TreeAmbience } from "@/frontend/features/wish-tree/components/TreeAmbience";
import type {
  TreeSeason,
  TreeSky,
  TreeStage,
  WishLeafView,
} from "@/frontend/shared/catalogs";

const VIEW = { w: 400, h: 360 };
const GROUND_Y = 344;

interface Canopy {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface TreeGeometry {
  trunkTop: number;
  trunkWidth: number;
  canopy: Canopy;
  branches: number;
}

/** The tree grows only from how many leaves it carries. */
const TREE_GEOMETRY: Record<TreeStage, TreeGeometry> = {
  sprout: {
    trunkTop: 252,
    trunkWidth: 6,
    canopy: { cx: 200, cy: 226, rx: 52, ry: 38 },
    branches: 2,
  },
  young: {
    trunkTop: 222,
    trunkWidth: 9,
    canopy: { cx: 200, cy: 194, rx: 80, ry: 56 },
    branches: 3,
  },
  growing: {
    trunkTop: 196,
    trunkWidth: 13,
    canopy: { cx: 200, cy: 164, rx: 110, ry: 76 },
    branches: 4,
  },
  full: {
    trunkTop: 176,
    trunkWidth: 17,
    canopy: { cx: 200, cy: 144, rx: 136, ry: 94 },
    branches: 5,
  },
  ancient: {
    trunkTop: 160,
    trunkWidth: 21,
    canopy: { cx: 200, cy: 130, rx: 156, ry: 106 },
    branches: 6,
  },
};

const SEASON_CANOPY: Record<TreeSeason, string> = {
  spring: "#C7E7A6",
  summer: "#9FD293",
  autumn: "#E9C58C",
  winter: "#D3DCE0",
};

const BARK = { light: "#B08968", dark: "#8A6A4F" };

function trunkPath(geo: TreeGeometry): string {
  const { trunkTop, trunkWidth } = geo;
  const base = trunkWidth * 1.7;
  const top = trunkWidth * 0.55;
  const mid = (GROUND_Y + trunkTop) / 2;
  return [
    `M${200 - base} ${GROUND_Y}`,
    `C${200 - base * 0.72} ${mid} ${200 - top} ${trunkTop + 26} ${200 - top} ${trunkTop}`,
    `L${200 + top} ${trunkTop}`,
    `C${200 + top} ${trunkTop + 26} ${200 + base * 0.72} ${mid} ${200 + base} ${GROUND_Y}`,
    "Z",
  ].join(" ");
}

function branchPaths(geo: TreeGeometry): string[] {
  const { canopy, trunkTop, branches } = geo;
  const startY = trunkTop + 12;
  const spread = branches === 1 ? 0 : 140 / (branches - 1);

  return Array.from({ length: branches }).map((_, i) => {
    const deg = 200 + spread * i;
    const rad = (deg * Math.PI) / 180;
    const tipX = canopy.cx + Math.cos(rad) * canopy.rx * 0.72;
    const tipY = canopy.cy + Math.sin(rad) * canopy.ry * 0.72;
    const ctrlX = (200 + tipX) / 2;
    const ctrlY = startY - (startY - tipY) * 0.25;
    return `M200 ${startY} Q${ctrlX} ${ctrlY} ${tipX} ${tipY}`;
  });
}

interface WishTreeCanvasProps {
  stage: TreeStage;
  season: TreeSeason;
  sky: TreeSky;
  leaves: WishLeafView[];
  canopyRef?: RefObject<HTMLDivElement>;
  /** Highlighted while a new leaf is being dragged over the canopy */
  dropActive?: boolean;
  onSelectLeaf: (leaf: WishLeafView) => void;
}

/**
 * The tree itself. Every leaf sits at a slot decided by the server,
 * so hanging a new one never shuffles the leaves already there.
 */
export function WishTreeCanvas({
  stage,
  season,
  sky,
  leaves,
  canopyRef,
  dropActive = false,
  onSelectLeaf,
}: WishTreeCanvasProps) {
  const geo = TREE_GEOMETRY[stage];
  const { canopy } = geo;
  const isNight = sky.phase === "night";
  const leafCount = leaves.length;
  const leafSize = leafCount > 16 ? "xs" : leafCount > 8 ? "sm" : "md";
  const canopyTint = SEASON_CANOPY[season];
  const canopyOpacity = Math.min(0.42, 0.06 + leafCount * 0.028);

  const pct = (value: number, total: number) => `${(value / total) * 100}%`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-black/5 shadow-softer">
      <div className="relative w-full" style={{ aspectRatio: "400 / 360" }}>
        <TreeAmbience sky={sky} season={season} leafCount={leafCount} />

        <svg
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          className="absolute inset-0 h-full w-full"
          fill="none"
          aria-hidden
        >
          {/* watercolour canopy behind the leaves */}
          <ellipse
            cx={canopy.cx}
            cy={canopy.cy}
            rx={canopy.rx * 1.06}
            ry={canopy.ry * 1.06}
            fill={canopyTint}
            opacity={canopyOpacity}
            style={{ filter: "blur(16px)", transition: "all 900ms ease" }}
          />
          <ellipse
            cx={canopy.cx - canopy.rx * 0.3}
            cy={canopy.cy + canopy.ry * 0.18}
            rx={canopy.rx * 0.62}
            ry={canopy.ry * 0.66}
            fill={canopyTint}
            opacity={canopyOpacity * 0.7}
            style={{ filter: "blur(14px)", transition: "all 900ms ease" }}
          />

          {/* ground */}
          <ellipse
            cx="200"
            cy={GROUND_Y + 4}
            rx="150"
            ry="16"
            fill={isNight ? "#3C4A44" : "#B9CFA6"}
            opacity="0.5"
            style={{ filter: "blur(5px)" }}
          />

          <g style={{ transition: "all 900ms ease" }}>
            {branchPaths(geo).map((d, i) => (
              <path
                key={`branch-${i}`}
                d={d}
                stroke={BARK.dark}
                strokeWidth={Math.max(2, geo.trunkWidth * 0.42)}
                strokeLinecap="round"
                opacity="0.9"
              />
            ))}
            <path d={trunkPath(geo)} fill={BARK.light} />
            <path
              d={`M200 ${GROUND_Y} L200 ${geo.trunkTop}`}
              stroke={BARK.dark}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.25"
            />
          </g>
        </svg>

        {/* canopy drop zone + leaves */}
        <div
          ref={canopyRef}
          className={cn(
            "absolute rounded-full transition-colors duration-300",
            dropActive && "bg-white/25 ring-2 ring-white/60"
          )}
          style={{
            left: pct(canopy.cx - canopy.rx, VIEW.w),
            top: pct(canopy.cy - canopy.ry, VIEW.h),
            width: pct(canopy.rx * 2, VIEW.w),
            height: pct(canopy.ry * 2, VIEW.h),
          }}
        >
          {dropActive ? (
            <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] font-medium text-bedi-slate/70">
              여기에 놓아 주세요
            </span>
          ) : null}
        </div>

        {leaves.map((leaf, i) => {
          const x = canopy.cx + leaf.nx * canopy.rx * 0.9;
          const y = canopy.cy + leaf.ny * canopy.ry * 0.9;

          return (
            <motion.button
              key={leaf.id}
              type="button"
              onClick={() => onSelectLeaf(leaf)}
              aria-label={`${leaf.text} — 그날의 기억 보기`}
              title={leaf.text}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1.5"
              style={{ left: pct(x, VIEW.w), top: pct(y, VIEW.h) }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 20,
                delay: Math.min(i, 12) * 0.05,
              }}
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.12 }}
            >
              <WishLeaf
                kind={leaf.kind}
                shape={leaf.shape}
                size={leafSize}
                glow={leaf.glow}
                sway
                style={{
                  transform: `rotate(${leaf.rotate}deg) scale(${leaf.scale})`,
                  animationDelay: `${(i % 7) * 0.4}s`,
                }}
              />
            </motion.button>
          );
        })}

        {leafCount === 0 ? (
          <p
            className={cn(
              "absolute inset-x-0 bottom-6 text-center text-xs",
              isNight ? "text-white/60" : "text-bedi-slate/45"
            )}
          >
            아직 잎이 없는 나무예요
          </p>
        ) : null}
      </div>
    </div>
  );
}
