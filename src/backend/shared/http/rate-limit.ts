/**
 * Tiny in-process sliding-window limiter (single task deployment).
 * Keeps one child's chat from running away with the demo budget.
 */

const hits = new Map<string, number[]>();

export interface WindowLimit {
  windowMs: number;
  max: number;
}

export const CHILD_CHAT_LIMITS: WindowLimit[] = [
  { windowMs: 10 * 60_000, max: 40 },
  { windowMs: 24 * 60 * 60_000, max: 300 },
];

/** Returns true and records the hit when every window still has room. */
export function allowRequest(
  key: string,
  limits: WindowLimit[],
  now = Date.now()
): boolean {
  const longest = Math.max(...limits.map((l) => l.windowMs));
  const recent = (hits.get(key) ?? []).filter((t) => now - t < longest);
  for (const limit of limits) {
    const inWindow = recent.filter((t) => now - t < limit.windowMs).length;
    if (inWindow >= limit.max) {
      hits.set(key, recent);
      return false;
    }
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 50_000) hits.clear();
  return true;
}

export function resetRateLimits() {
  hits.clear();
}
