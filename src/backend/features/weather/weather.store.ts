import "server-only";
import { createMapStore } from "@/backend/shared/persist/map-store";

/**
 * Coarse child location for weather (1 decimal ≈ 11km).
 * Exact coordinates are never stored. Not shared via AI Bridge.
 */
export interface CoarseLocationRecord {
  userId: string;
  lat: number;
  lon: number;
  /** ISO expiry — Dynamo/json cleanup on read */
  expiresAt: string;
  updatedAt: string;
}

const store = createMapStore<CoarseLocationRecord>("coarse-locations.json", {
  userIdKey: "userId",
});

const TTL_DAYS = 7;

export function roundCoord(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function saveCoarseLocation(
  userId: string,
  lat: number,
  lon: number
): Promise<CoarseLocationRecord> {
  const now = Date.now();
  const record: CoarseLocationRecord = {
    userId,
    lat: roundCoord(lat),
    lon: roundCoord(lon),
    expiresAt: new Date(now + TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  return store.set(userId, record);
}

export async function getCoarseLocation(
  userId: string
): Promise<CoarseLocationRecord | null> {
  const row = await store.get(userId);
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await store.delete(userId);
    return null;
  }
  return row;
}
