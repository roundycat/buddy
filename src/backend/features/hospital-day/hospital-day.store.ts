import { createMapStore } from "@/backend/shared/persist/map-store";
import type { HospitalDayItem } from "./hospital-day.types";

const store = createMapStore<HospitalDayItem>("hospital-schedule.json", {
  userIdKey: "childUserId",
});

export async function listScheduleForChild(
  childUserId: string,
  dateKey?: string
): Promise<HospitalDayItem[]> {
  const all = await store.values();
  return all
    .filter(
      (item) =>
        item.childUserId === childUserId &&
        (!dateKey || item.dateKey === dateKey)
    )
    .sort((a, b) => {
      const ta = a.time || "99:99";
      const tb = b.time || "99:99";
      if (ta !== tb) return ta.localeCompare(tb);
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export async function getScheduleItem(
  id: string
): Promise<HospitalDayItem | undefined> {
  return store.get(id);
}

export async function saveScheduleItem(
  item: HospitalDayItem
): Promise<HospitalDayItem> {
  return store.set(item.id, item);
}

export async function deleteScheduleItem(id: string): Promise<void> {
  await store.delete(id);
}
