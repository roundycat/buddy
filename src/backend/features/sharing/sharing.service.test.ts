import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/shared/persist/map-store", () =>
  import("@/test/stubs/memory-map-store")
);

import { resetMemoryMapStores } from "@/test/stubs/memory-map-store";
import { DomainError } from "@/backend/shared/http/domain-error";
import {
  getChildShareChoices,
  getChildSharingView,
  updateChildShareChoices,
} from "./sharing.service";
import { DEFAULT_SHARE_CHOICES } from "./sharing.types";

beforeEach(() => {
  resetMemoryMapStores();
});

describe("child sharing preferences", () => {
  it("starts from the defaults (media private)", async () => {
    expect(await getChildShareChoices("child")).toEqual({
      mood: "share",
      adventures: "share",
      memoryHighlights: "share",
      media: "private",
    });
    expect((await getChildSharingView("child")).updatedAt).toBeNull();
  });

  it("updates only the categories that were sent", async () => {
    const view = await updateChildShareChoices("child", {
      media: "share",
      mood: "private",
    });
    expect(view.choices).toEqual({
      ...DEFAULT_SHARE_CHOICES,
      media: "share",
      mood: "private",
    });
    expect(view.updatedAt).toBeTruthy();

    await updateChildShareChoices("child", { adventures: "private" });
    expect(await getChildShareChoices("child")).toEqual({
      mood: "private",
      adventures: "private",
      memoryHighlights: "share",
      media: "share",
    });
  });

  it.each([
    [{ chat: "share" }],
    [{ mood: "maybe" }],
    [{}],
    [null],
  ])("rejects invalid patches (%j)", async (patch) => {
    await expect(
      updateChildShareChoices("child", patch as Record<string, unknown> | null)
    ).rejects.toBeInstanceOf(DomainError);
    expect(await getChildShareChoices("child")).toEqual(DEFAULT_SHARE_CHOICES);
  });
});
