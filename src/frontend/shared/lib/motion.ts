"use client";

import { useReducedMotion, type Transition, type Variants } from "framer-motion";

/**
 * Shared motion language.
 *
 * Everything here is slow-ish and spring-based on purpose: the app should
 * feel like a picture book being opened, never like a dashboard snapping
 * into place. Durations under ~250ms read as "system", so we stay above it.
 */

/** Default spring for anything that appears or moves. */
export const softSpring: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 26,
  mass: 0.9,
};

/** Gentle ease for opacity-only changes. */
export const softEase: Transition = {
  duration: 0.42,
  ease: [0.22, 1, 0.36, 1],
};

/** Parent container that lets its children drift in one after another. */
export const softStagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

/** Child of `softStagger` — rises a little as it fades in. */
export const softRise: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: softSpring },
};

/** Section entrance for a whole feature screen. */
export const softFadeIn: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: softEase },
};

/**
 * Returns motion props that collapse to a plain fade (or nothing) when the
 * child's device asks for reduced motion. Vestibular sensitivity is common
 * after treatment, so this is a care requirement, not a nicety.
 */
export function useSoftMotion() {
  const reduced = useReducedMotion();

  return {
    reduced,
    /** Spread onto a container that should stagger its children. */
    stagger: reduced
      ? { initial: false as const }
      : {
          variants: softStagger,
          initial: "hidden" as const,
          animate: "visible" as const,
        },
    /** Spread onto each staggered child. */
    item: reduced ? {} : { variants: softRise },
    /** Spread onto a standalone element that should ease in. */
    fadeIn: reduced
      ? { initial: false as const }
      : {
          variants: softFadeIn,
          initial: "hidden" as const,
          animate: "visible" as const,
        },
    /** Press feedback that stays out of the way when motion is reduced. */
    press: reduced ? {} : { whileTap: { scale: 0.97 } },
    transition: reduced ? { duration: 0 } : softSpring,
  };
}
