import "server-only";
import { createMapStore } from "@/backend/shared/persist/map-store";
import type { MemoryLetter } from "./memory-post.types";

interface LetterBag {
  userId: string;
  letters: MemoryLetter[];
}

const store = createMapStore<LetterBag>("memory-post.json");

export async function getMemoryLetters(userId: string): Promise<MemoryLetter[]> {
  return [...((await store.get(userId))?.letters ?? [])];
}

export async function saveMemoryLetters(
  userId: string,
  letters: MemoryLetter[]
): Promise<void> {
  await store.set(userId, { userId, letters: letters.slice(0, 40) });
}

export async function clearMemoryLetters(userId: string): Promise<void> {
  await store.delete(userId);
}
