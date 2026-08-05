import { createMapStore } from "@/backend/shared/persist/map-store";
import type { MemoryEvent } from "./memory-timeline.types";

/** Wrapper so MapStore T extends object */
interface MemoryEventBag {
  userId: string;
  events: MemoryEvent[];
}

const store = createMapStore<MemoryEventBag>("memory-events.json");

export async function listMemoryEvents(userId: string): Promise<MemoryEvent[]> {
  return (await store.get(userId))?.events ?? [];
}

export async function appendMemoryEvent(
  userId: string,
  event: MemoryEvent
): Promise<MemoryEvent> {
  const prev = await listMemoryEvents(userId);
  const withoutDup = prev.filter((e) => e.id !== event.id);
  const next = [event, ...withoutDup];
  await store.set(userId, { userId, events: next });
  return event;
}

export async function clearMemoryEventsForUser(userId: string) {
  await store.delete(userId);
}
