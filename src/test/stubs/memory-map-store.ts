/**
 * Vitest stub — in-memory `createMapStore` so service tests never touch
 * `.data/` or DynamoDB. Use with:
 *   vi.mock("@/backend/shared/persist/map-store", () => import("@/test/stubs/memory-map-store"));
 */
import type { MapStore } from "@/backend/shared/persist/map-store";

const registry = new Map<string, Map<string, unknown>>();

export function createMapStore<T extends object>(
  filename: string,
  options?: { userIdKey?: keyof T & string }
): MapStore<T> {
  const name = filename.replace(/\.json$/i, "");
  if (!registry.has(name)) registry.set(name, new Map());
  const map = registry.get(name)! as Map<string, T>;
  const userIdKey = (options?.userIdKey ?? "userId") as string;
  const clone = <V>(value: V): V => structuredClone(value);

  return {
    async get(id) {
      const value = map.get(id);
      return value === undefined ? undefined : clone(value);
    },
    async set(id, value) {
      map.set(id, clone(value));
      return value;
    },
    async delete(id) {
      map.delete(id);
    },
    async has(id) {
      return map.has(id);
    },
    async values() {
      return Array.from(map.values()).map(clone);
    },
    async entries() {
      return Array.from(map.entries()).map(
        ([id, value]) => [id, clone(value)] as [string, T]
      );
    },
    async clearByUserId(userId) {
      Array.from(map.entries()).forEach(([id, value]) => {
        const record = value as Record<string, unknown>;
        if (record[userIdKey] === userId || id.startsWith(`${userId}:`)) {
          map.delete(id);
        }
      });
    },
    async clearAll() {
      map.clear();
    },
  };
}

/** Empty every store between tests (store objects keep their references). */
export function resetMemoryMapStores() {
  Array.from(registry.values()).forEach((map) => map.clear());
}

/** Read-only peek for assertions. */
export function memoryStoreValues(filename: string): unknown[] {
  const map = registry.get(filename.replace(/\.json$/i, ""));
  return map ? Array.from(map.values()) : [];
}
