import "server-only";
import { todayKey } from "@/backend/shared/time/date";
import { mapPool } from "@/backend/shared/async/map-pool";
import { listMemoryUserIds } from "@/backend/features/conversation/conversation.store";
import { listPersonaUserIds } from "@/backend/features/persona/persona.store";
import { listGuardianUserIds } from "@/backend/features/guardian-link/guardian-link.store";
import { isChildConsentPending } from "@/backend/features/consent/consent.guard";
import { consolidateMemoryForUser } from "./memory-consolidate.job";
import { prepareMissionsForUser } from "./mission-prep.job";
import { prepareParentSummaryForGuardian } from "./parent-summary.job";
import { indexKbSummariesForUser } from "./kb-index.job";
import { refineEmotionsForUser } from "./emotion-refine.job";
import { updateStoriesForUser } from "./story-update.job";
import { observeBatchRun } from "@/backend/ai/orchestrator";
import { startKbIngestion } from "@/backend/ai/kb/ingest";
import { purgeExpiredCoarseLocations } from "@/backend/features/weather/weather.store";

/** Max concurrent child jobs within one dawn batch phase. */
const CHILD_CONCURRENCY = 3;

export type DailyBatchResult = {
  dateKey: string;
  memory: { ok: number; fail: number };
  emotion: { ok: number; fail: number; refined: number };
  stories: { ok: number; fail: number; composed: number };
  missions: { ok: number; fail: number; created: number };
  parent: { ok: number; fail: number };
  kbIndex: { ok: number; fail: number; docs: number };
  kbIngestion: { started: boolean; jobId?: string; reason?: string };
  /** Coarse locations removed after their 7-day retention */
  expiredLocations: number;
};

async function listChildUserIds(): Promise<string[]> {
  const [mem, personas] = await Promise.all([
    listMemoryUserIds(),
    listPersonaUserIds(),
  ]);
  const ids = Array.from(new Set([...mem, ...personas]));
  // No AI processing for children still waiting on legal-guardian consent.
  const pending = await Promise.all(ids.map((id) => isChildConsentPending(id)));
  return ids.filter((_, i) => !pending[i]);
}

function tallyOkFail(rows: Array<{ ok: boolean }>) {
  let ok = 0;
  let fail = 0;
  for (const r of rows) {
    if (r.ok) ok += 1;
    else fail += 1;
  }
  return { ok, fail };
}

/**
 * Dawn batch (EventBridge → /api/cron/daily):
 * Memory Extraction → Emotion Analysis → Story Updates → Mission prep
 * → Parent Summary → KB index
 *
 * Child phases run with limited concurrency (Promise pool).
 */
export async function runDailyBatch(
  dateKey = todayKey()
): Promise<DailyBatchResult> {
  return observeBatchRun("batch.daily", async () => {
    // Retention first: it must not wait on (or fail with) the AI phases.
    const expiredLocations = await purgeExpiredCoarseLocations().catch((error) => {
      console.error("[batch] location purge failed", error);
      return 0;
    });
    const childIds = await listChildUserIds();
    const guardianIds = await listGuardianUserIds();

    const memoryRows = await mapPool(childIds, CHILD_CONCURRENCY, (userId) =>
      consolidateMemoryForUser(userId, dateKey)
    );
    const memory = tallyOkFail(memoryRows);

    const emotionRows = await mapPool(childIds, CHILD_CONCURRENCY, (userId) =>
      refineEmotionsForUser(userId, dateKey)
    );
    const emotion = {
      ...tallyOkFail(emotionRows),
      refined: emotionRows.filter((r) => r.refined).length,
    };

    const storyRows = await mapPool(childIds, CHILD_CONCURRENCY, (userId) =>
      updateStoriesForUser(userId)
    );
    const stories = {
      ...tallyOkFail(storyRows),
      composed: storyRows.filter((r) => r.composed).length,
    };

    const missionRows = await mapPool(childIds, CHILD_CONCURRENCY, (userId) =>
      prepareMissionsForUser(userId, dateKey)
    );
    const missions = {
      ...tallyOkFail(missionRows),
      created: missionRows.filter((r) => r.created).length,
    };

    const parentRows = await mapPool(
      guardianIds,
      CHILD_CONCURRENCY,
      (guardianUserId) =>
        prepareParentSummaryForGuardian(guardianUserId, dateKey)
    );
    const parent = tallyOkFail(parentRows);

    const kbRows = await mapPool(childIds, CHILD_CONCURRENCY, (userId) =>
      indexKbSummariesForUser(userId, dateKey)
    );
    const kbIndex = {
      ...tallyOkFail(kbRows),
      docs: kbRows.reduce((n, r) => n + (r.docs ?? 0), 0),
    };

    // New summaries are only searchable after the KB re-ingests them.
    const kbIngestion =
      kbIndex.docs > 0
        ? await startKbIngestion()
        : { started: false, reason: "no_new_docs" };

    return {
      dateKey,
      memory,
      emotion,
      stories,
      missions,
      parent,
      kbIndex,
      kbIngestion,
      expiredLocations,
    };
  });
}
