/**
 * Tiny in-process sliding-window limiter (single task deployment).
 * Keeps one child's chat from running away with the demo budget.
 */

const hits = new Map<string, number[]>();

export interface WindowLimit {
  windowMs: number;
  max: number;
}

/** One child's chat turns (each turn is 2–3 model calls). */
export const CHILD_CHAT_LIMITS: WindowLimit[] = [
  { windowMs: 10 * 60_000, max: 40 },
  { windowMs: 24 * 60 * 60_000, max: 200 },
];

/** Wrong passwords for one e-mail from one address (successful logins do not count). */
export const LOGIN_FAILURE_LIMITS: WindowLimit[] = [{ windowMs: 10 * 60_000, max: 10 }];
/** Login attempts from one address — judges in one room share an address. */
export const LOGIN_IP_LIMITS: WindowLimit[] = [{ windowMs: 10 * 60_000, max: 60 }];
/** New accounts from one address. */
export const SIGNUP_IP_LIMITS: WindowLimit[] = [
  { windowMs: 60 * 60_000, max: 10 },
  { windowMs: 24 * 60 * 60_000, max: 30 },
];

const MAX_KEYS = 50_000;

function recentHits(key: string, limits: WindowLimit[], now: number): number[] {
  const longest = Math.max(...limits.map((l) => l.windowMs));
  return (hits.get(key) ?? []).filter((t) => now - t < longest);
}

function hasRoom(recent: number[], limits: WindowLimit[], now: number): boolean {
  return limits.every(
    (limit) => recent.filter((t) => now - t < limit.windowMs).length < limit.max
  );
}

/** Returns true and records the hit when every window still has room. */
export function allowRequest(
  key: string,
  limits: WindowLimit[],
  now = Date.now()
): boolean {
  const recent = recentHits(key, limits, now);
  if (!hasRoom(recent, limits, now)) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) hits.clear();
  return true;
}

/** Room left without recording anything (pair with recordHit for failures only). */
export function hasRequestRoom(
  key: string,
  limits: WindowLimit[],
  now = Date.now()
): boolean {
  return hasRoom(recentHits(key, limits, now), limits, now);
}

export function recordHit(key: string, limits: WindowLimit[], now = Date.now()) {
  const recent = recentHits(key, limits, now);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) hits.clear();
}

/**
 * The caller's address behind the hosting proxy (Render and most PaaS put the
 * client first in X-Forwarded-For).
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function resetRateLimits() {
  hits.clear();
}
