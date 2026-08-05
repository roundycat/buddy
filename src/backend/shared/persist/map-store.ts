import { isDynamoPersistence } from "@/backend/shared/config/env";
import { createJsonMapStore } from "@/backend/shared/persist/json-map-store";
import { createDynamoMapStore } from "@/backend/shared/persist/dynamodb-map-store";

export interface MapStore<T extends object> {
  get(id: string): Promise<T | undefined>;
  set(id: string, value: T): Promise<T>;
  delete(id: string): Promise<void>;
  has(id: string): Promise<boolean>;
  values(): Promise<T[]>;
  entries(): Promise<Array<[string, T]>>;
  clearByUserId(userId: string): Promise<void>;
  clearAll(): Promise<void>;
}

/**
 * Persistence-aware map store.
 * PERSISTENCE=json → local .data JSON files
 * PERSISTENCE=dynamodb → BediApp single table (pk=MAP#ns, sk=id)
 */
export function createMapStore<T extends object>(
  filename: string,
  options?: { userIdKey?: keyof T & string }
): MapStore<T> {
  const namespace = filename.replace(/\.json$/i, "");

  if (!isDynamoPersistence()) {
    const json = createJsonMapStore<T>(filename, options);
    return {
      async get(id) {
        return json.get(id);
      },
      async set(id, value) {
        return json.set(id, value);
      },
      async delete(id) {
        json.delete(id);
      },
      async has(id) {
        return json.has(id);
      },
      async values() {
        return json.values();
      },
      async entries() {
        return json.entries();
      },
      async clearByUserId(userId) {
        json.clearByUserId(userId);
      },
      async clearAll() {
        json.clearAll();
      },
    };
  }

  const ddb = createDynamoMapStore<T>(namespace);
  const userIdKey = (options?.userIdKey ?? "userId") as string;

  return {
    get: (id) => ddb.getAsync(id),
    set: (id, value) => ddb.setAsync(id, value),
    delete: (id) => ddb.deleteAsync(id),
    has: (id) => ddb.hasAsync(id),
    values: () => ddb.valuesAsync(),
    entries: () => ddb.entriesAsync(),
    clearByUserId: (userId) => ddb.clearByUserIdAsync(userId, userIdKey),
    clearAll: () => ddb.clearAllAsync(),
  };
}
