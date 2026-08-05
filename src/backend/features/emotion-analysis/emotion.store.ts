import { createMapStore } from "@/backend/shared/persist/map-store";
import type { EmotionAnalysisRecord } from "./emotion.types";

interface EmotionBag {
  userId: string;
  records: EmotionAnalysisRecord[];
}

const store = createMapStore<EmotionBag>("emotion-analyses.json");

const MAX_RECORDS = 120;

export async function listEmotionRecords(
  userId: string
): Promise<EmotionAnalysisRecord[]> {
  return [...((await store.get(userId))?.records ?? [])];
}

export async function appendEmotionRecord(
  record: EmotionAnalysisRecord
): Promise<EmotionAnalysisRecord> {
  const current = (await store.get(record.userId))?.records ?? [];
  const next = [...current, record].slice(-MAX_RECORDS);
  await store.set(record.userId, { userId: record.userId, records: next });
  return record;
}

export async function clearEmotionForUser(userId: string) {
  await store.delete(userId);
}
