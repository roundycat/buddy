"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { StorybookPage } from "@/frontend/shared/types/growth-storybook";
import { AiMadeBadge } from "@/frontend/shared/components/AiMadeBadge";

type Motif = NonNullable<StorybookPage["illustration"]>["motif"];
type PaletteKey = NonNullable<StorybookPage["illustration"]>["palette"];

interface ScenePalette {
  skyTop: string;
  skyBottom: string;
  sun: string;
  far: string;
  mid: string;
  near: string;
  leaf: string;
  bloom: string;
  stroke: string;
}

const SCENE_PALETTE: Record<PaletteKey, ScenePalette> = {
  sage: {
    skyTop: "#E4EFDF",
    skyBottom: "#FBF6E7",
    sun: "#FBEFC6",
    far: "#C6D8C1",
    mid: "#9DBE9E",
    near: "#79A180",
    leaf: "#8FB489",
    bloom: "#F2CFC0",
    stroke: "#67795F",
  },
  rose: {
    skyTop: "#FBE9EC",
    skyBottom: "#FFF6EE",
    sun: "#FDE3D2",
    far: "#EAC9D0",
    mid: "#D79FAC",
    near: "#C4808F",
    leaf: "#CBA6AD",
    bloom: "#F7D6C6",
    stroke: "#95666F",
  },
  sky: {
    skyTop: "#DEEBF6",
    skyBottom: "#FFF8EA",
    sun: "#FDF0CE",
    far: "#C4D9E9",
    mid: "#94B7D2",
    near: "#6E9AB9",
    leaf: "#A2C3C8",
    bloom: "#F3D9C6",
    stroke: "#57748A",
  },
  amber: {
    skyTop: "#FBEECB",
    skyBottom: "#FFF7EC",
    sun: "#FFE9AE",
    far: "#EED7AA",
    mid: "#DDB878",
    near: "#C99B5C",
    leaf: "#C6B276",
    bloom: "#F6D8B6",
    stroke: "#8C6E45",
  },
  violet: {
    skyTop: "#E7E1F2",
    skyBottom: "#FBF3EC",
    sun: "#F6E7D4",
    far: "#D3C9E4",
    mid: "#B2A2CD",
    near: "#9483B5",
    leaf: "#AC9EC6",
    bloom: "#EDD4DE",
    stroke: "#6B5F86",
  },
};

/** One shared probe: the child's crayon avatar, if they have one. */
let cachedAvatar: string | null | undefined;

export function useChildAvatar() {
  const [url, setUrl] = useState<string | null>(cachedAvatar ?? null);

  useEffect(() => {
    if (cachedAvatar !== undefined) {
      setUrl(cachedAvatar);
      return;
    }
    let alive = true;
    const src = "/api/persona/avatar";
    const probe = new window.Image();
    probe.onload = () => {
      cachedAvatar = src;
      if (alive) setUrl(src);
    };
    probe.onerror = () => {
      cachedAvatar = null;
      if (alive) setUrl(null);
    };
    probe.src = src;
    return () => {
      alive = false;
    };
  }, []);

  return url;
}

/**
 * The child's own crayon friend, walked into the illustration so every
 * spread has "us" in it rather than a stock scene.
 */
export function AvatarActor({
  url,
  side = "left",
  size = 38,
  label = "내 친구",
}: {
  url: string | null;
  side?: "left" | "right";
  size?: number;
  label?: string;
}) {
  if (!url) return null;
  return (
    <motion.div
      className="pointer-events-none absolute bottom-[5%] z-10"
      style={{
        [side]: "6%",
        width: `${size}%`,
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.7 }}
    >
      <motion.div
        animate={{ y: [0, -5, 0], rotate: side === "left" ? [-1.2, 1.2, -1.2] : [1.2, -1.2, 1.2] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="w-full drop-shadow-[0_8px_14px_rgba(80,64,44,0.28)]"
          draggable={false}
        />
      </motion.div>
      <div className="mx-auto h-2 w-[62%] rounded-[50%] bg-[#5A4A34]/16 blur-[3px]" />
    </motion.div>
  );
}

function Clouds({ p }: { p: ScenePalette }) {
  return (
    <>
      {[
        { top: "12%", size: 78, delay: 0, dur: 46 },
        { top: "24%", size: 54, delay: 8, dur: 62 },
        { top: "7%", size: 42, delay: 20, dur: 54 },
      ].map((cloud, index) => (
        <motion.div
          key={index}
          className="absolute rounded-[50%] bg-white/70 blur-[6px]"
          style={{
            top: cloud.top,
            width: cloud.size,
            height: cloud.size * 0.42,
            boxShadow: `0 6px 12px ${p.far}55`,
          }}
          initial={{ left: `${-20 - index * 12}%` }}
          animate={{ left: "115%" }}
          transition={{
            duration: cloud.dur,
            repeat: Infinity,
            delay: cloud.delay,
            ease: "linear",
          }}
        />
      ))}
    </>
  );
}

function Birds() {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <motion.svg
          key={index}
          viewBox="0 0 24 10"
          className="absolute h-2.5 w-6 text-[#6B5B48]/45"
          style={{ top: `${16 + index * 7}%` }}
          initial={{ left: "-12%" }}
          animate={{ left: "112%" }}
          transition={{
            duration: 26 + index * 6,
            repeat: Infinity,
            delay: index * 5,
            ease: "linear",
          }}
        >
          <motion.path
            d="M1 6 Q6 0 11 6 Q16 0 22 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            animate={{ d: ["M1 6 Q6 0 11 6 Q16 0 22 6", "M1 4 Q6 7 11 4 Q16 7 22 4"] }}
            transition={{ duration: 0.9, repeat: Infinity, repeatType: "reverse" }}
          />
        </motion.svg>
      ))}
    </>
  );
}

function MotifArt({ motif, p, id }: { motif: Motif; p: ScenePalette; id: string }) {
  if (motif === "castle") {
    return (
      <g>
        <rect x="126" y="94" width="68" height="76" rx="7" fill={p.near} />
        <path d="M126 94 L160 64 L194 94 Z" fill={p.stroke} opacity="0.72" />
        <rect x="92" y="110" width="36" height="60" rx="6" fill={p.mid} />
        <path d="M92 110 L110 84 L128 110 Z" fill={p.stroke} opacity="0.6" />
        <rect x="192" y="116" width="34" height="54" rx="6" fill={p.mid} />
        <path d="M192 116 L209 92 L226 116 Z" fill={p.stroke} opacity="0.6" />
        <path d="M110 84 L110 70" stroke={p.stroke} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M110 70 L122 74 L110 78 Z" fill={p.bloom} />
        <path d="M160 64 L160 48" stroke={p.stroke} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M160 48 L175 53 L160 58 Z" fill={p.bloom} />
        {[140, 158, 176].map((x) => (
          <rect key={x} x={x} y="110" width="9" height="13" rx="4.5" fill={p.sun} />
        ))}
        {[100, 112].map((x) => (
          <rect key={x} x={x} y="124" width="7" height="10" rx="3.5" fill={p.sun} opacity="0.9" />
        ))}
        <path d="M149 170 v-24 a11 11 0 0 1 22 0 v24 z" fill={p.stroke} opacity="0.82" />
        <path d="M160 146 v24" stroke={p.sun} strokeWidth="0.9" opacity="0.5" />
        <path d="M120 170 q40 -8 80 0" stroke={p.sun} strokeWidth="2" fill="none" opacity="0.35" />
      </g>
    );
  }

  if (motif === "forest") {
    return (
      <g>
        {[
          { x: 58, s: 0.8 },
          { x: 108, s: 1.05 },
          { x: 168, s: 0.92 },
          { x: 226, s: 1.12 },
          { x: 272, s: 0.75 },
        ].map((tree) => (
          <g key={tree.x} transform={`translate(${tree.x} 170) scale(${tree.s})`}>
            <rect x="-4" y="-34" width="8" height="34" rx="4" fill="#9B7A58" />
            <ellipse cx="0" cy="-52" rx="27" ry="23" fill={p.leaf} />
            <ellipse cx="-13" cy="-40" rx="19" ry="15" fill={p.mid} opacity="0.85" />
            <ellipse cx="14" cy="-42" rx="17" ry="14" fill={p.near} opacity="0.75" />
            <ellipse cx="2" cy="-66" rx="15" ry="12" fill={p.far} opacity="0.85" />
          </g>
        ))}
        <path
          d="M0 172 q80 -10 160 2 q80 12 160 -2"
          stroke={p.sun}
          strokeWidth="3"
          fill="none"
          opacity="0.35"
        />
      </g>
    );
  }

  if (motif === "garden") {
    return (
      <g>
        {[
          { x: 44, h: 34, c: p.bloom },
          { x: 78, h: 46, c: "#F6C8CE" },
          { x: 112, h: 28, c: "#FBE3AE" },
          { x: 150, h: 50, c: p.bloom },
          { x: 186, h: 32, c: "#E8C7E4" },
          { x: 222, h: 44, c: "#F6C8CE" },
          { x: 258, h: 30, c: "#FBE3AE" },
          { x: 288, h: 40, c: p.bloom },
        ].map((flower) => (
          <g key={flower.x}>
            <path
              d={`M${flower.x} 172 q3 -${flower.h / 2} 0 -${flower.h}`}
              stroke={p.near}
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
            <ellipse
              cx={flower.x - 6}
              cy={172 - flower.h * 0.55}
              rx="6"
              ry="3.4"
              fill={p.leaf}
            />
            {[0, 72, 144, 216, 288].map((angle) => (
              <ellipse
                key={angle}
                cx={flower.x + Math.cos((angle * Math.PI) / 180) * 6}
                cy={172 - flower.h + Math.sin((angle * Math.PI) / 180) * 6}
                rx="4.6"
                ry="4.6"
                fill={flower.c}
              />
            ))}
            <circle cx={flower.x} cy={172 - flower.h} r="3.2" fill="#F7E7A8" />
          </g>
        ))}
        <ellipse cx="160" cy="176" rx="150" ry="14" fill={p.near} opacity="0.28" />
      </g>
    );
  }

  if (motif === "tree") {
    return (
      <g>
        <path
          d="M152 172 q-6 -44 -2 -66 q-16 -8 -12 -20 q10 6 14 12 q4 -14 12 -22 q4 12 -2 24 q10 -6 20 -6 q-8 12 -20 16 q4 26 0 62 z"
          fill="#9A7856"
          opacity="0.9"
        />
        <ellipse cx="160" cy="74" rx="66" ry="46" fill={p.leaf} />
        <ellipse cx="118" cy="88" rx="34" ry="26" fill={p.mid} opacity="0.9" />
        <ellipse cx="204" cy="86" rx="32" ry="25" fill={p.near} opacity="0.82" />
        <ellipse cx="160" cy="50" rx="40" ry="26" fill={p.far} opacity="0.85" />
        {[
          [116, 104],
          [140, 116],
          [182, 112],
          [206, 100],
          [160, 120],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <path d={`M${x} ${y! - 12} v10`} stroke={p.stroke} strokeWidth="1" opacity="0.45" />
            <path
              d={`M${x} ${y} q-7 -7 0 -12 q7 5 0 12 z`}
              fill={p.bloom}
              opacity="0.95"
            />
          </g>
        ))}
        <ellipse cx="160" cy="174" rx="86" ry="12" fill={p.near} opacity="0.3" />
      </g>
    );
  }

  if (motif === "window") {
    return (
      <g>
        <rect x="76" y="34" width="168" height="140" rx="12" fill="#FFFDF6" opacity="0.55" />
        <path
          d="M92 168 V88 a68 68 0 0 1 136 0 v80 z"
          fill={`url(#${id}-glass)`}
          stroke="#FFFDF6"
          strokeWidth="8"
        />
        <path d="M160 92 v76" stroke="#FFFDF6" strokeWidth="5" />
        <path d="M96 130 h128" stroke="#FFFDF6" strokeWidth="5" />
        <circle cx="196" cy="106" r="12" fill={p.sun} />
        <path d="M104 156 q26 -18 52 -4 q28 14 52 -6" stroke={p.mid} strokeWidth="6" fill="none" opacity="0.6" />
        <rect x="70" y="168" width="180" height="9" rx="4.5" fill="#F2E6CE" />
        <ellipse cx="112" cy="164" rx="13" ry="7" fill={p.leaf} />
        <ellipse cx="112" cy="158" rx="7" ry="6" fill={p.bloom} />
      </g>
    );
  }

  if (motif === "sunrise") {
    return (
      <g>
        <circle cx="160" cy="118" r="34" fill={p.sun} />
        <circle cx="160" cy="118" r="50" fill={p.sun} opacity="0.35" />
        {Array.from({ length: 10 }, (_, i) => {
          const angle = (i / 10) * Math.PI * 2;
          return (
            <path
              key={i}
              d={`M${160 + Math.cos(angle) * 54} ${118 + Math.sin(angle) * 54} L${
                160 + Math.cos(angle) * 66
              } ${118 + Math.sin(angle) * 66}`}
              stroke={p.sun}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.65"
            />
          );
        })}
        <path d="M116 172 V116 a44 44 0 0 1 88 0 v56 z" fill="#FFFDF6" opacity="0.42" />
        <path
          d="M116 172 V116 a44 44 0 0 1 88 0 v56"
          fill="none"
          stroke={p.stroke}
          strokeWidth="4"
          opacity="0.55"
        />
        <path d="M138 172 q22 -34 44 0" fill={p.sun} opacity="0.7" />
        <path d="M60 176 q100 -14 200 0" stroke={p.near} strokeWidth="5" fill="none" opacity="0.4" />
      </g>
    );
  }

  if (motif === "home") {
    return (
      <g>
        <rect x="112" y="112" width="96" height="60" rx="6" fill="#FFF6E6" />
        <path d="M104 114 L160 72 L216 114 Z" fill={p.near} />
        <rect x="184" y="80" width="12" height="24" rx="4" fill={p.mid} />
        <rect x="130" y="130" width="22" height="20" rx="4" fill={p.sun} />
        <rect x="168" y="128" width="26" height="44" rx="5" fill={p.stroke} opacity="0.75" />
        <circle cx="174" cy="150" r="2" fill={p.sun} />
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx="190"
            cy={72 - i * 4}
            r={4 + i}
            fill="#FFFFFF"
            opacity="0.5"
            animate={{ cy: [72 - i * 4, 44 - i * 8], opacity: [0.55, 0] }}
            transition={{ duration: 4, repeat: Infinity, delay: i * 1.1 }}
          />
        ))}
        {[70, 84, 98, 226, 240, 254].map((x) => (
          <rect key={x} x={x} y="152" width="5" height="20" rx="2.5" fill="#E3CBA6" />
        ))}
        <path d="M60 158 h60 M220 158 h64" stroke="#E3CBA6" strokeWidth="4" />
        <path d="M138 172 q22 -16 44 0" fill={p.far} opacity="0.5" />
        <ellipse cx="160" cy="176" rx="130" ry="12" fill={p.near} opacity="0.26" />
      </g>
    );
  }

  return (
    <g>
      <circle cx="238" cy="56" r="26" fill="#FFF7DF" />
      <circle cx="228" cy="50" r="26" fill={p.skyTop} />
      {Array.from({ length: 26 }, (_, i) => (
        <circle
          key={i}
          cx={12 + ((i * 37) % 300)}
          cy={14 + ((i * 53) % 120)}
          r={i % 4 === 0 ? 1.9 : 1.1}
          fill="#FFFDF0"
          opacity={0.55 + ((i % 5) * 0.09)}
        />
      ))}
      <path d="M0 176 q60 -26 120 -8 q70 20 120 -10 q50 -20 80 -2 v22 H0 z" fill={p.near} opacity="0.5" />
      {motif === "friends" ? (
        <g>
          <ellipse cx="160" cy="170" rx="52" ry="12" fill={p.bloom} opacity="0.6" />
          <path d="M132 168 h56 l-6 -12 h-44 z" fill={p.mid} opacity="0.7" />
          <path d="M214 168 v-16" stroke={p.stroke} strokeWidth="2" />
          <circle cx="214" cy="146" r="8" fill={p.sun} />
        </g>
      ) : null}
    </g>
  );
}

function AnimationLayer({ animation }: { animation: StorybookPage["animation"] }) {
  if (animation === "butterflies") {
    return (
      <>
        {[0, 1].map((index) => (
          <motion.span
            key={index}
            className="absolute text-lg"
            initial={{ left: "-8%", top: `${30 + index * 18}%` }}
            animate={{
              left: "108%",
              top: [`${30 + index * 18}%`, `${18 + index * 24}%`, `${30 + index * 18}%`],
            }}
            transition={{ duration: 11 + index * 2, repeat: Infinity, delay: index * 2 }}
          >
            🦋
          </motion.span>
        ))}
      </>
    );
  }

  if (animation === "leaves") {
    return (
      <>
        {[0, 1, 2, 3].map((index) => (
          <motion.span
            key={index}
            className="absolute text-sm"
            style={{ left: `${14 + index * 22}%` }}
            initial={{ top: "-8%", rotate: 0, opacity: 0 }}
            animate={{ top: "92%", rotate: 260, opacity: [0, 0.9, 0] }}
            transition={{ duration: 8 + index * 1.6, repeat: Infinity, delay: index * 1.7 }}
          >
            🍃
          </motion.span>
        ))}
      </>
    );
  }

  if (animation === "fireflies") {
    return (
      <>
        {Array.from({ length: 9 }, (_, index) => (
          <motion.span
            key={index}
            className="absolute h-1.5 w-1.5 rounded-full bg-amber-200"
            style={{
              left: `${10 + ((index * 27) % 82)}%`,
              top: `${30 + ((index * 19) % 52)}%`,
              boxShadow: "0 0 8px rgba(253,224,140,0.95)",
            }}
            animate={{ opacity: [0.15, 1, 0.15], y: [0, -12, 0] }}
            transition={{ duration: 3.2 + (index % 4), repeat: Infinity, delay: index * 0.3 }}
          />
        ))}
      </>
    );
  }

  if (animation === "sunlight") {
    return (
      <motion.div
        className="absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(255,248,220,0.55)_50%,transparent_65%)]"
        animate={{ x: ["-30%", "30%", "-30%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
    );
  }

  return (
    <>
      {Array.from({ length: 7 }, (_, index) => (
        <motion.span
          key={index}
          className="absolute text-xs text-amber-300"
          style={{ left: `${12 + ((index * 31) % 78)}%`, top: `${22 + ((index * 23) % 50)}%` }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.25, 0.7] }}
          transition={{ duration: 2.6 + (index % 3), repeat: Infinity, delay: index * 0.35 }}
        >
          ✦
        </motion.span>
      ))}
    </>
  );
}

/**
 * Hand-painted looking storybook plate. Used as the real illustration for the
 * living book and as the graceful fallback while Bedrock paints the sealed one.
 */
export function WatercolorScene({
  page,
  avatarUrl,
  actorSide = "left",
}: {
  page: StorybookPage;
  avatarUrl?: string | null;
  actorSide?: "left" | "right";
}) {
  const art = page.illustration ?? {
    motif: "stars" as Motif,
    palette: "sage" as PaletteKey,
    alt: "따뜻한 그림책 장면",
  };
  const p = SCENE_PALETTE[art.palette];
  const id = `sc-${page.id.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div
      className="relative aspect-[3/2] overflow-hidden rounded-[18px]"
      role="img"
      aria-label={art.alt}
    >
      <svg
        viewBox="0 0 320 213"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.skyTop} />
            <stop offset="72%" stopColor={p.skyBottom} />
            <stop offset="100%" stopColor={p.skyBottom} />
          </linearGradient>
          <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.skyTop} />
            <stop offset="100%" stopColor={p.sun} />
          </linearGradient>
          <radialGradient id={`${id}-vignette`} cx="50%" cy="46%" r="72%">
            <stop offset="55%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#5C4A32" stopOpacity="0.2" />
          </radialGradient>
          <filter id={`${id}-grain`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>

        <rect width="320" height="213" fill={`url(#${id}-sky)`} />

        <path
          d="M0 132 q52 -30 104 -12 q56 20 108 -6 q56 -28 108 -4 v103 H0 z"
          fill={p.far}
          opacity="0.55"
        />
        <path
          d="M0 152 q64 -24 128 -6 q66 18 124 -10 q40 -18 68 -2 v79 H0 z"
          fill={p.mid}
          opacity="0.6"
        />

        <MotifArt motif={art.motif} p={p} id={id} />

        <path
          d="M0 178 q70 -14 142 2 q76 16 178 -4 v37 H0 z"
          fill={p.near}
          opacity="0.72"
        />
        {Array.from({ length: 22 }, (_, i) => (
          <path
            key={i}
            d={`M${6 + i * 15} 205 q2 -9 4 -13`}
            stroke={p.stroke}
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.3"
            fill="none"
          />
        ))}

        <rect width="320" height="213" fill={`url(#${id}-vignette)`} />
        <rect
          width="320"
          height="213"
          filter={`url(#${id}-grain)`}
          opacity="0.09"
          style={{ mixBlendMode: "multiply" }}
        />
      </svg>

      <Clouds p={p} />
      {art.motif === "stars" || art.motif === "friends" ? null : <Birds />}
      <AnimationLayer animation={page.animation} />
      <AvatarActor url={avatarUrl ?? null} side={actorSide} />

      <div className="pointer-events-none absolute inset-0 rounded-[18px] shadow-[inset_0_0_0_1px_rgba(255,253,246,0.75),inset_0_0_30px_rgba(120,98,68,0.14)]" />
    </div>
  );
}

/**
 * Tipped-in plate: Bedrock painting when the book is sealed, hand-painted
 * scene until then. The child's crayon friend always stands in the frame.
 */
export function StoryIllustration({
  page,
  sealed,
  actorSide = "left",
}: {
  page: StorybookPage;
  sealed: boolean;
  actorSide?: "left" | "right";
}) {
  const avatarUrl = useChildAvatar();
  const [url, setUrl] = useState(page.illustration?.imageUrl ?? null);
  const [loading, setLoading] = useState(
    sealed &&
      !page.illustration?.imageUrl &&
      page.illustration?.imageStatus !== "failed"
  );

  useEffect(() => {
    if (!sealed || url || page.illustration?.imageStatus === "failed") return;
    let cancelled = false;
    setLoading(true);
    void fetch(
      `/api/storybook/page/${encodeURIComponent(page.id)}/illustration`,
      { method: "POST" }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.imageUrl) setUrl(data.imageUrl);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sealed, page.id, page.illustration?.imageStatus, url]);

  return (
    <figure className="relative mx-auto w-full">
      <div className="relative rounded-[20px] bg-[#FFFDF6] p-[6px] shadow-[0_10px_26px_-14px_rgba(84,68,48,0.55)] ring-1 ring-[#D9CDBB]/60">
        {url ? (
          <div className="relative aspect-[3/2] overflow-hidden rounded-[15px] bg-[#F4EEE1]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={page.illustration?.alt || page.title}
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_58%,rgba(92,74,50,0.22)_100%)]" />
            <AiMadeBadge className="left-1.5 top-1.5" />
            <AvatarActor url={avatarUrl} side={actorSide} size={34} />
          </div>
        ) : (
          <WatercolorScene page={page} avatarUrl={avatarUrl} actorSide={actorSide} />
        )}

        {loading && !url ? (
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <span className="rounded-full bg-white/85 px-3 py-1 text-[10px] text-bedi-slate/50 shadow-softer backdrop-blur-sm">
              이 장면을 물감으로 칠하는 중…
            </span>
          </div>
        ) : null}
      </div>

      {page.illustration?.alt ? (
        <figcaption className="mt-2 text-center font-display text-[11px] italic text-bedi-slate/38">
          {page.illustration.alt}
        </figcaption>
      ) : null}
    </figure>
  );
}
