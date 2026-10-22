import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/shared/persist/map-store", () => import("@/test/stubs/memory-map-store"));

import { resetMemoryMapStores } from "@/test/stubs/memory-map-store";
import { getCoarseLocation, purgeExpiredCoarseLocations, saveCoarseLocation } from "./weather.store";

beforeEach(() => resetMemoryMapStores());

describe("coarse location retention", () => {
  it("rounds to one decimal and the dawn batch drops it after 7 days", async () => {
    const saved = await saveCoarseLocation("child-a", 37.56654, 126.97797);
    expect(saved).toMatchObject({ lat: 37.6, lon: 127 });
    await saveCoarseLocation("child-b", 35.1, 129.0);

    expect(await purgeExpiredCoarseLocations(Date.now() + 6 * 86_400_000)).toBe(0);
    expect(await purgeExpiredCoarseLocations(Date.now() + 8 * 86_400_000)).toBe(2);
    expect(await getCoarseLocation("child-a")).toBeNull();
  });
});
