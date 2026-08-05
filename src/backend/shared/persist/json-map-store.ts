import { readJsonFile, writeJsonFile } from "@/backend/shared/persist/json-file";

/**
 * Generic in-memory + JSON-file map store for local MVP persistence.
 * TODO [AWS DynamoDB]: replace with table access; keep the same get/save/clear API.
 */
export function createJsonMapStore<T extends { userId?: string } | object>(
  filename: string,
  options?: {
    /** When clearing by userId, match this field (default: userId) */
    userIdKey?: keyof T & string;
  }
) {
  type MapValue = T;
  const userIdKey = (options?.userIdKey ?? "userId") as string;

  const store = new Map<string, MapValue>(
    Object.entries(readJsonFile<Record<string, MapValue>>(filename, {}))
  );

  function persist() {
    const obj: Record<string, MapValue> = {};
    Array.from(store.entries()).forEach(([id, value]) => {
      obj[id] = value;
    });
    writeJsonFile(filename, obj);
  }

  return {
    get(id: string): MapValue | undefined {
      return store.get(id);
    },
    set(id: string, value: MapValue): MapValue {
      store.set(id, value);
      persist();
      return value;
    },
    delete(id: string) {
      store.delete(id);
      persist();
    },
    has(id: string) {
      return store.has(id);
    },
    values(): MapValue[] {
      return Array.from(store.values());
    },
    entries(): Array<[string, MapValue]> {
      return Array.from(store.entries());
    },
    clearByUserId(userId: string) {
      Array.from(store.entries()).forEach(([id, value]) => {
        const record = value as Record<string, unknown>;
        if (record[userIdKey] === userId || id.startsWith(`${userId}:`)) {
          store.delete(id);
        }
      });
      persist();
    },
    /** Full wipe (dev only) */
    clearAll() {
      store.clear();
      persist();
    },
  };
}
