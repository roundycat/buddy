import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/shared/persist/map-store", () => import("@/test/stubs/memory-map-store"));

import { resetMemoryMapStores } from "@/test/stubs/memory-map-store";
import { appendConversationMessages, forModelContext, getConversationHistory } from "./conversation.store";
import type { ConversationMessage } from "./conversation.types";

beforeEach(() => resetMemoryMapStores());

const msg = (id: string, role: "user" | "assistant", at: string, refused = false): ConversationMessage => ({
  id,
  role,
  content: id,
  createdAt: at,
  ...(refused ? { meta: { refused: true } } : {}),
});

describe("conversation store", () => {
  it("keeps time order when a turn is saved late, and loses nothing when saves overlap", async () => {
    // The second turn is saved first (the first one waited for its safety review).
    await Promise.all([
      appendConversationMessages("c1", [
        msg("u2", "user", "2026-10-22T10:00:05.000Z"),
        msg("a2", "assistant", "2026-10-22T10:00:07.000Z"),
      ]),
      appendConversationMessages("c1", [
        msg("u1", "user", "2026-10-22T10:00:00.000Z"),
        msg("a1", "assistant", "2026-10-22T10:00:01.000Z"),
      ]),
    ]);
    expect((await getConversationHistory("c1")).map((m) => m.id)).toEqual(["u1", "a1", "u2", "a2"]);
  });

  it("leaves declined turns out of what a model sees again", () => {
    const all = [msg("u1", "user", "a", true), msg("a1", "assistant", "b", true), msg("u2", "user", "c")];
    expect(forModelContext(all).map((m) => m.id)).toEqual(["u2"]);
  });
});
