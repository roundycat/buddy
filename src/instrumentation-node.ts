import { ensureSeedAccounts } from "@/backend/bootstrap/seed-accounts";
import { startDailyScheduler } from "@/backend/bootstrap/daily-scheduler";

export async function bootstrapNodeServer() {
  try {
    await ensureSeedAccounts();
  } catch (error) {
    console.error("[bootstrap] seed accounts failed", error);
  }
  startDailyScheduler();
}
