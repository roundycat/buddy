import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";

/**
 * Tiny JSON file persistence (PERSISTENCE=json).
 * Survives Next.js hot reload / server restart (unlike in-memory Maps alone).
 *
 * BEDDY_DATA_DIR points at a persistent disk in production (e.g. Render /var/data);
 * the default is `.data` under the working directory for local development.
 * Writes go to a temp file first and are renamed into place, so a crash mid-write
 * never leaves a half-written file.
 */

export function dataDir(): string {
  const fromEnv = process.env.BEDDY_DATA_DIR?.trim();
  return fromEnv ? path.resolve(fromEnv) : path.join(process.cwd(), ".data");
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readJsonFile<T>(filename: string, fallback: T): T {
  try {
    const filePath = path.join(dataDir(), filename);
    if (!existsSync(filePath)) return fallback;
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[persist] read ${filename} failed`, error);
    return fallback;
  }
}

export function writeJsonFile(filename: string, data: unknown) {
  try {
    const dir = dataDir();
    ensureDir(dir);
    const filePath = path.join(dir, filename);
    const tmp = `${filePath}.${process.pid}.tmp`;
    const body =
      process.env.NODE_ENV === "production"
        ? JSON.stringify(data)
        : JSON.stringify(data, null, 2);
    writeFileSync(tmp, body, "utf8");
    renameSync(tmp, filePath);
  } catch (error) {
    console.warn(`[persist] write ${filename} failed`, error);
  }
}
