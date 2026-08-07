"use client";

import type { CSSProperties } from "react";
import { cn } from "@/frontend/shared/lib/utils";
import {
  LEAF_CATALOG,
  type LeafShape,
  type WishKind,
} from "@/frontend/shared/catalogs";

interface WishLeafProps {
  kind: WishKind;
  /** Overrides the kind's own shape — only used for previews */
  shape?: LeafShape;
  size?: "xs" | "sm" | "md" | "lg";
  /** 0 plain · 1 soft · 2 bright */
  glow?: 0 | 1 | 2;
  /** Breathe in the wind */
  sway?: boolean;
  /** Play the unfurl animation on mount */
  animateIn?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

const SIZE = {
  xs: 26,
  sm: 36,
  md: 52,
  lg: 84,
} as const;

const STAR_LOBES = [0, 72, 144, 216, 288];

/**
 * One wish drawn as one leaf.
 * Shape carries the kind of longing, colour carries its feeling,
 * and the glow carries how much memory that day holds.
 */
export function WishLeaf({
  kind,
  shape,
  size = "md",
  glow = 0,
  sway = false,
  animateIn = false,
  className,
  style,
  title,
}: WishLeafProps) {
  const species = LEAF_CATALOG[kind] ?? LEAF_CATALOG.make;
  const form = shape ?? species.shape;
  const { leaf, leafDeep, vein, glow: glowColor } = species.palette;
  const px = SIZE[size];
  const gradientId = `leaf-${kind}-${form}-${size}`;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        animateIn && "tree-leaf-unfurl",
        sway && "tree-leaf-sway",
        className
      )}
      style={{ width: px, height: px * 1.2, ...style }}
      title={title}
    >
      <svg
        viewBox="0 0 40 48"
        width={px}
        height={px * 1.2}
        fill="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={leaf} />
            <stop offset="100%" stopColor={leafDeep} />
          </linearGradient>
        </defs>

        {glow > 0 ? (
          <ellipse
            cx="20"
            cy="29"
            rx={glow === 2 ? 19 : 16}
            ry={glow === 2 ? 21 : 18}
            fill={glowColor}
            opacity={glow === 2 ? 0.9 : 0.55}
            style={{ filter: `blur(${glow === 2 ? 6 : 4}px)` }}
            className={glow === 2 ? "tree-leaf-glow" : undefined}
          />
        ) : null}

        {/* stalk reaching up to the branch */}
        <path
          d="M20 12 C20 8 20 5 20 2"
          stroke={vein}
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        <Blade form={form} fill={`url(#${gradientId})`} vein={vein} />
      </svg>
    </div>
  );
}

function Blade({
  form,
  fill,
  vein,
}: {
  form: LeafShape;
  fill: string;
  vein: string;
}) {
  const midrib = (
    <path
      d="M20 13 C20 24 20 34 20 44"
      stroke={vein}
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.45"
    />
  );

  const sideVeins = (
    <g stroke={vein} strokeWidth="0.8" strokeLinecap="round" opacity="0.3">
      <path d="M20 22 L13 19" />
      <path d="M20 22 L27 19" />
      <path d="M20 31 L14 28" />
      <path d="M20 31 L26 28" />
    </g>
  );

  switch (form) {
    case "round":
      return (
        <>
          <ellipse cx="20" cy="28" rx="15" ry="17" fill={fill} />
          {midrib}
          {sideVeins}
        </>
      );

    case "oval":
      return (
        <>
          <ellipse cx="20" cy="28" rx="10" ry="18" fill={fill} />
          {midrib}
          {sideVeins}
        </>
      );

    case "willow":
      return (
        <>
          <ellipse cx="20" cy="29" rx="6" ry="19" fill={fill} />
          {midrib}
        </>
      );

    case "teardrop":
      return (
        <>
          <path
            d="M20 11 C28 20 31 27 31 34 C31 41 26 46 20 46 C14 46 9 41 9 34 C9 27 12 20 20 11 Z"
            fill={fill}
          />
          {midrib}
          {sideVeins}
        </>
      );

    case "heart":
      return (
        <>
          <path
            d="M20 46 C13 39 5 32 5 24 C5 17 10 13 14 13 C17 13 19 15 20 17 C21 15 23 13 26 13 C30 13 35 17 35 24 C35 32 27 39 20 46 Z"
            fill={fill}
          />
          {midrib}
        </>
      );

    case "ginkgo":
      return (
        <>
          <path
            d="M20 12 C17 15 8 28 6 39 C11 44 16 45 19 41 L20 37 L21 41 C24 45 29 44 34 39 C32 28 23 15 20 12 Z"
            fill={fill}
          />
          <g stroke={vein} strokeWidth="0.8" strokeLinecap="round" opacity="0.3">
            <path d="M20 14 C16 24 12 32 10 39" />
            <path d="M20 14 C24 24 28 32 30 39" />
            <path d="M20 14 C19 25 18 33 17 41" />
            <path d="M20 14 C21 25 22 33 23 41" />
          </g>
        </>
      );

    case "clover":
      return (
        <>
          <circle cx="13" cy="24" r="9" fill={fill} />
          <circle cx="27" cy="24" r="9" fill={fill} />
          <circle cx="20" cy="36" r="9" fill={fill} />
          <path
            d="M20 26 L20 44"
            stroke={vein}
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.4"
          />
        </>
      );

    case "star":
      return (
        <>
          <g>
            {STAR_LOBES.map((deg) => (
              <ellipse
                key={deg}
                cx="20"
                cy="18"
                rx="6.5"
                ry="11"
                fill={fill}
                transform={`rotate(${deg} 20 28)`}
              />
            ))}
          </g>
          <circle cx="20" cy="28" r="4" fill={fill} />
          <path
            d="M20 32 L20 45"
            stroke={vein}
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.35"
          />
        </>
      );

    default:
      return <ellipse cx="20" cy="28" rx="12" ry="17" fill={fill} />;
  }
}
