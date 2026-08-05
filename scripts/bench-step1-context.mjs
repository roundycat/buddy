/**
 * Micro-bench: sequential vs parallel companion context fetches (local stores).
 * Run: node --env-file=.env.local scripts/bench-step1-context.mjs
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), ".data");

async function loadJson(name) {
  try {
    const raw = await readFile(path.join(dataDir, name), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function sequential() {
  const t0 = Date.now();
  await loadJson("personas.json");
  await loadJson("conversations.json");
  await loadJson("memories.json");
  await loadJson("wish-trees.json");
  return Date.now() - t0;
}

async function parallel() {
  const t0 = Date.now();
  await Promise.all([
    loadJson("personas.json"),
    loadJson("conversations.json"),
    loadJson("memories.json"),
    loadJson("wish-trees.json"),
  ]);
  return Date.now() - t0;
}

const files = await readdir(dataDir).catch(() => []);
console.log("STEP 1 context I/O bench (.data)", { files: files.length });

const seqSamples = [];
const parSamples = [];
for (let i = 0; i < 20; i++) {
  seqSamples.push(await sequential());
  parSamples.push(await parallel());
}
const avg = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
console.log({
  sequentialAvgMs: avg(seqSamples),
  parallelAvgMs: avg(parSamples),
  savedMs: avg(seqSamples) - avg(parSamples),
});
