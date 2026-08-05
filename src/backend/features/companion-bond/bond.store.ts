import { createMapStore } from "@/backend/shared/persist/map-store";
import type { CompanionBondRecord } from "./bond.types";

const store = createMapStore<CompanionBondRecord>("companion-bonds.json", {
  userIdKey: "userId",
});

export async function getBondRecord(
  userId: string
): Promise<CompanionBondRecord | undefined> {
  return store.get(userId);
}

export async function saveBondRecord(
  record: CompanionBondRecord
): Promise<CompanionBondRecord> {
  return store.set(record.userId, record);
}
