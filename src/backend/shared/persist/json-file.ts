import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

/**
 * Tiny JSON file persistence for local MVP stores.
 * Survives Next.js hot reload / server restart (unlike in-memory Maps alone).
 * TODO [AWS DynamoDB]: remove when tables are wired.
 */

const DATA_DIR = path.join(process.cwd(), ".data");

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readJsonFile<T>(filename: string, fallback: T): T {
  try {
    const filePath = path.join(DATA_DIR, filename);
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
    ensureDir();
    const filePath = path.join(DATA_DIR, filename);
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.warn(`[persist] write ${filename} failed`, error);
  }
}
