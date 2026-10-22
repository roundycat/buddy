import { readJsonFile, writeJsonFile } from "@/backend/shared/persist/json-file";

/**
 * In-memory + JSON-file map store (PERSISTENCE=json).
 *
 * One Map per file for the whole Node process: Next.js can evaluate a module more
 * than once (separate server bundles), and two modules may open the same file.
 * Separate Maps would overwrite each other's writes, so every store for a given
 * file shares the instance kept on globalThis.
 *
 * Writes are coalesced (one file write per burst, ~50 ms) and flushed
 * synchronously when the process exits.
 */

type Shared = {
  map: Map<string, unknown>;
  timer: ReturnType<typeof setTimeout> | null;
};

type Registry = {
  files: Map<string, Shared>;
  exitHook: boolean;
};

const REGISTRY_KEY = Symbol.for("beddy.jsonMapStores");
const WRITE_DELAY_MS = 50;

function registry(): Registry {
  const g = globalThis as unknown as Record<symbol, Registry | undefined>;
  let r = g[REGISTRY_KEY];
  if (!r) {
    r = { files: new Map(), exitHook: false };
    g[REGISTRY_KEY] = r;
  }
  return r;
}

function writeNow(filename: string, shared: Shared) {
  if (shared.timer) {
    clearTimeout(shared.timer);
    shared.timer = null;
  }
  const obj: Record<string, unknown> = {};
  shared.map.forEach((value, id) => {
    obj[id] = value;
  });
  writeJsonFile(filename, obj);
}

/** Write every pending file now (process exit, tests). */
export function flushJsonMapStores() {
  registry().files.forEach((shared, filename) => {
    if (shared.timer) writeNow(filename, shared);
  });
}

function sharedFor(filename: string): Shared {
  const r = registry();
  let shared = r.files.get(filename);
  if (!shared) {
    shared = {
      map: new Map(Object.entries(readJsonFile<Record<string, unknown>>(filename, {}))),
      timer: null,
    };
    r.files.set(filename, shared);
  }
  if (!r.exitHook && typeof process !== "undefined" && typeof process.on === "function") {
    r.exitHook = true;
    process.on("exit", flushJsonMapStores);
    // Write pending data as soon as the platform asks the server to stop (deploys).
    // Next.js registers its own SIGTERM handler; if nothing else listens, exit here
    // so this listener never keeps a terminating process alive.
    process.on("SIGTERM", () => {
      flushJsonMapStores();
      if (process.listenerCount("SIGTERM") <= 1) process.exit(0);
    });
  }
  return shared;
}

export function createJsonMapStore<T extends { userId?: string } | object>(
  filename: string,
  options?: {
    /** When clearing by userId, match this field (default: userId) */
    userIdKey?: keyof T & string;
  }
) {
  type MapValue = T;
  const userIdKey = (options?.userIdKey ?? "userId") as string;
  const shared = sharedFor(filename);
  const store = shared.map as Map<string, MapValue>;

  function persist() {
    if (shared.timer) return;
    shared.timer = setTimeout(() => writeNow(filename, shared), WRITE_DELAY_MS);
    // Never keep a short-lived script alive just for this timer.
    (shared.timer as { unref?: () => void }).unref?.();
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
