"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

/**
 * App-wide motion settings.
 *
 * `reducedMotion="user"` makes every Framer animation in the app honour the
 * OS "reduce motion" setting automatically — the drifting clouds, fireflies
 * and page flips collapse to plain opacity changes instead of us having to
 * guard each one by hand.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
