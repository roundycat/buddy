import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.PERSISTENCE = "json";
vi.mock("@/backend/shared/persist/map-store", () => import("@/test/stubs/memory-map-store"));

import { resetMemoryMapStores } from "@/test/stubs/memory-map-store";
import { createMapStore } from "@/backend/shared/persist/map-store";
import { markDailyBatchRun, STALE_RUN_MS, tryClaimDailyBatchRun, type BatchRunRecord } from "./batch-run.store";

beforeEach(() => resetMemoryMapStores());

const runs = () => createMapStore<BatchRunRecord>("batch-runs.json", { userIdKey: "dateKey" });

describe("dawn batch claim", () => {
  it("runs once a day, retries a failed run, and reclaims a run cut off by a restart", async () => {
    expect((await tryClaimDailyBatchRun("2026-10-23")).claimed).toBe(true);
    expect((await tryClaimDailyBatchRun("2026-10-23")).claimed).toBe(false);

    await markDailyBatchRun("2026-10-23", "failed");
    expect((await tryClaimDailyBatchRun("2026-10-23")).claimed).toBe(true);
    await markDailyBatchRun("2026-10-23", "done");
    expect((await tryClaimDailyBatchRun("2026-10-23")).claimed).toBe(false);

    // Started 3 hours ago and never finished: the process stopped mid-run.
    await runs().set("2026-10-24", {
      dateKey: "2026-10-24",
      status: "started",
      startedAt: new Date(Date.now() - STALE_RUN_MS - 3_600_000).toISOString(),
    });
    expect((await tryClaimDailyBatchRun("2026-10-24")).claimed).toBe(true);
    // A run started a moment ago is still live.
    expect((await tryClaimDailyBatchRun("2026-10-24")).claimed).toBe(false);
  });
});
