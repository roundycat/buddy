import "server-only";

/**
 * AI Bridge privacy filter — strip anything that looks like raw chat or coords.
 * Summaries only; never pass transcripts or precise location.
 */

const RAW_CHAT_MARKERS =
  /^(user|assistant|child|아이|베디)\s*[:：]/im;
const COORD_MARKERS =
  /\b(-?\d{1,3}\.\d+)\s*[,/]\s*(-?\d{1,3}\.\d+)\b|위도|경도|GPS|좌표/;

export function looksLikeRawChat(text: string): boolean {
  const lines = text.split(/\n/).filter((l) => l.trim());
  if (lines.length >= 3) {
    const marked = lines.filter((l) => RAW_CHAT_MARKERS.test(l.trim())).length;
    if (marked >= 2) return true;
  }
  return /원문\s*대화|chat\s*log|transcript/i.test(text);
}

export function looksLikeCoordinates(text: string): boolean {
  return COORD_MARKERS.test(text);
}

export function filterBridgeText(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (looksLikeRawChat(t)) return null;
  if (looksLikeCoordinates(t)) return null;
  return t.slice(0, 800);
}

export function filterBridgeHits<T extends { text: string }>(hits: T[]): T[] {
  const out: T[] = [];
  for (const h of hits) {
    const cleaned = filterBridgeText(h.text);
    if (!cleaned) continue;
    out.push({ ...h, text: cleaned });
  }
  return out;
}
