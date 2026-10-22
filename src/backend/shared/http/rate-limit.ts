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
/** New accounts from one address (a ward's or office's Wi-Fi is one address). */
export const SIGNUP_IP_LIMITS: WindowLimit[] = [
  { windowMs: 60 * 60_000, max: 20 },
  { windowMs: 24 * 60 * 60_000, max: 60 },
];

const MAX_KEYS = 50_000;
const LONGEST_WINDOW_MS = 24 * 60 * 60_000;

/**
 * Over the key cap: drop keys whose last hit is older than any window, then the
 * least recently used fifth. Never everything at once — that would let a flood
 * of new keys reset every counter.
 */
function evict(now: number) {
  if (hits.size <= MAX_KEYS) return;
  const byLastHit: Array<[string, number]> = [];
  hits.forEach((times, key) => {
    const last = times[times.length - 1] ?? 0;
    if (now - last >= LONGEST_WINDOW_MS) hits.delete(key);
    else byLastHit.push([key, last]);
  });
  if (hits.size <= MAX_KEYS) return;
  byLastHit.sort((a, b) => a[1] - b[1]);
  for (const [key] of byLastHit.slice(0, Math.ceil(byLastHit.length / 5))) hits.delete(key);
}

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
  evict(now);
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

/** Record one hit; returns its time so a later success can take it back. */
export function recordHit(key: string, limits: WindowLimit[], now = Date.now()): number {
  const recent = recentHits(key, limits, now);
  recent.push(now);
  hits.set(key, recent);
  evict(now);
  return now;
}

/** Take back a hit recorded before the outcome was known (e.g. a correct password). */
export function forgetHit(key: string, at: number) {
  const times = hits.get(key);
  if (!times) return;
  const i = times.lastIndexOf(at);
  if (i >= 0) times.splice(i, 1);
  if (!times.length) hits.delete(key);
}

/**
 * The caller's address.
 * - TRUST_CF_CONNECTING_IP=1 (Render): every request comes through Cloudflare,
 *   which sets CF-Connecting-IP itself — a value sent by the client is replaced.
 *   Elsewhere (CloudFront on AWS, local runs) a client could send that header,
 *   so it is ignored.
 * - Otherwise X-Forwarded-For is read from the right: proxies append, so the
 *   left side is whatever the client sent. TRUSTED_PROXY_HOPS is how many
 *   proxies of ours sit in front of the app (default 1).
 */
export function clientAddress(request: Request): string {
  if (process.env.TRUST_CF_CONNECTING_IP === "1") {
    const edge = request.headers.get("cf-connecting-ip")?.trim();
    if (edge) return edge;
  }
  const chain = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? "1") || 1);
  return chain[chain.length - hops] || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function resetRateLimits() {
  hits.clear();
}
