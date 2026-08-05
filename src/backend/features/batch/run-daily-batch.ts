import "server-only";
import { todayKey } from "@/backend/shared/time/date";
import { listMemoryUserIds } from "@/backend/features/conversation/conversation.store";
import { listPersonaUserIds } from "@/backend/features/persona/persona.store";
import { listGuardianUserIds } from "@/backend/features/guardian-link/guardian-link.store";
import { consolidateMemoryForUser } from "./memory-consolidate.job";
import { prepareMissionsForUser } from "./mission-prep.job";
import { prepareParentSummaryForGuardian } from "./parent-summary.job";
import { indexKbSummariesForUser } from "./kb-index.job";
import { observeBatchRun } from "@/backend/ai/llm-gateway";

export type DailyBatchResult = {
  dateKey: string;
  memory: { ok: number; fail: number };
  missions: { ok: number; fail: number; created: number };
  parent: { ok: number; fail: number };
  kbIndex: { ok: number; fail: number; docs: number };
};

async function listChildUserIds(): Promise<string[]> {
  const [mem, personas] = await Promise.all([
    listMemoryUserIds(),
    listPersonaUserIds(),
  ]);
  return Array.from(new Set([...mem, ...personas]));
}

/**
 * Dawn batch: memory consolidate → mission prep → parent summary.
 */
export async function runDailyBatch(
  dateKey = todayKey()
): Promise<DailyBatchResult> {
  return observeBatchRun("batch.daily", async () => {
    const childIds = await listChildUserIds();
    const guardianIds = await listGuardianUserIds();

    const memory = { ok: 0, fail: 0 };
    for (const userId of childIds) {
      const r = await consolidateMemoryForUser(userId, dateKey);
      if (r.ok) memory.ok += 1;
      else memory.fail += 1;
    }

    const missions = { ok: 0, fail: 0, created: 0 };
    for (const userId of childIds) {
      const r = await prepareMissionsForUser(userId, dateKey);
      if (r.ok) {
        missions.ok += 1;
        if (r.created) missions.created += 1;
      } else missions.fail += 1;
    }

    const parent = { ok: 0, fail: 0 };
    for (const guardianUserId of guardianIds) {
      const r = await prepareParentSummaryForGuardian(guardianUserId, dateKey);
      if (r.ok) parent.ok += 1;
      else parent.fail += 1;
    }

    const kbIndex = { ok: 0, fail: 0, docs: 0 };
    for (const userId of childIds) {
      const r = await indexKbSummariesForUser(userId, dateKey);
      if (r.ok) {
        kbIndex.ok += 1;
        kbIndex.docs += r.docs;
      } else kbIndex.fail += 1;
    }

    return { dateKey, memory, missions, parent, kbIndex };
  });
}
