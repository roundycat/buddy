import "server-only";
import { generateStabilityPng } from "@/backend/features/persona/avatar.generate";
import {
  getScheduleItem,
  saveScheduleItem,
} from "./hospital-day.store";
import { readScheduleImage, saveScheduleImage } from "./schedule-image.store";
import {
  SCHEDULE_IMAGE_PROMPT_VERSION,
  buildScheduleComicFallbackPrompt,
  buildScheduleComicPrompt,
} from "./schedule-image.prompt";
import type { HospitalDayItem } from "./hospital-day.types";

const generating = new Set<string>();

/** Core collapses the 2x2 grid into stray panels; only Ultra holds the layout. */
const COMIC_MODEL_ID = "stability.stable-image-ultra-v1:1";

/**
 * Stability answers HTTP 200 with an empty payload when its safety filter
 * rejects a prompt, and it does so intermittently for the same clinical text.
 */
function isPromptFiltered(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("no image payload")
  );
}

async function drawComic(item: HospitalDayItem, seed: number) {
  const detailed = buildScheduleComicPrompt(item);
  try {
    return await generateStabilityPng({
      ...detailed,
      seed,
      aspectRatio: "1:1",
      modelId: COMIC_MODEL_ID,
    });
  } catch (error) {
    if (!isPromptFiltered(error)) throw error;
    console.warn(
      `[schedule-image] prompt filtered for ${item.id}, retrying generic comic`
    );
    return generateStabilityPng({
      ...buildScheduleComicFallbackPrompt(),
      seed,
      aspectRatio: "1:1",
      modelId: COMIC_MODEL_ID,
    });
  }
}

function publicImageUrl(itemId: string, stamp?: number) {
  const v = stamp ?? Date.now();
  return `/api/hospital-day/image/${encodeURIComponent(itemId)}?v=${v}`;
}

function isCurrentPromptVersion(item: HospitalDayItem): boolean {
  return item.imagePromptVersion === SCHEDULE_IMAGE_PROMPT_VERSION;
}

async function waitForGeneration(itemId: string): Promise<HospitalDayItem | null> {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const item = await getScheduleItem(itemId);
    if (!item) return null;
    if (item.imageStatus === "ready" || item.imageStatus === "failed") {
      return item;
    }
    if (!generating.has(itemId) && item.imageStatus !== "pending") {
      return item;
    }
  }
  return (await getScheduleItem(itemId)) ?? null;
}

/**
 * Generate (or reuse) a wordless 4-panel comic for a parent schedule item.
 */
export async function ensureScheduleImage(
  itemId: string
): Promise<HospitalDayItem | null> {
  const existing = await getScheduleItem(itemId);
  if (!existing || existing.source !== "parent") return null;

  if (existing.imageStatus === "ready" && isCurrentPromptVersion(existing)) {
    const file = await readScheduleImage(itemId);
    if (file) {
      return {
        ...existing,
        imageUrl: existing.imageUrl || publicImageUrl(itemId),
      };
    }
  }

  if (generating.has(itemId)) {
    return waitForGeneration(itemId);
  }

  generating.add(itemId);
  const pending: HospitalDayItem = {
    ...existing,
    imageStatus: "pending",
    imagePromptVersion: SCHEDULE_IMAGE_PROMPT_VERSION,
    updatedAt: new Date().toISOString(),
  };
  await saveScheduleItem(pending);

  try {
    const seed =
      Math.abs(
        Array.from(itemId).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      ) % 4294967296;

    const generated = await drawComic(existing, seed);

    await saveScheduleImage(itemId, generated.bytes);
    const ready: HospitalDayItem = {
      ...pending,
      imageStatus: "ready",
      imageUrl: publicImageUrl(itemId),
      imagePromptVersion: SCHEDULE_IMAGE_PROMPT_VERSION,
      updatedAt: new Date().toISOString(),
    };
    return saveScheduleItem(ready);
  } catch (error) {
    console.warn("[schedule-image] generate failed", error);
    const failed: HospitalDayItem = {
      ...pending,
      imageStatus: "failed",
      imagePromptVersion: SCHEDULE_IMAGE_PROMPT_VERSION,
      updatedAt: new Date().toISOString(),
    };
    return saveScheduleItem(failed);
  } finally {
    generating.delete(itemId);
  }
}

/** Non-blocking kickoff after parent creates a schedule. */
export function kickoffScheduleImage(itemId: string): void {
  void ensureScheduleImage(itemId).catch((error) => {
    console.warn("[schedule-image] kickoff failed", error);
  });
}
