import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/shared/persist/map-store", () =>
  import("@/test/stubs/memory-map-store")
);

import { resetMemoryMapStores } from "@/test/stubs/memory-map-store";
import { DomainError } from "@/backend/shared/http/domain-error";
import { appendConversationMessages } from "@/backend/features/conversation/conversation.store";
import {
  DEFAULT_CONCERN_SUMMARY,
  answerConcernRequest,
  getPendingConcernRequest,
  listSharedConcernNotices,
  requestChildConsentForConcern,
} from "./concern-request.service";

const CHILD = "child-1";

beforeEach(() => {
  resetMemoryMapStores();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("concern consent requests", () => {
  it("creates one pending request and reuses it", async () => {
    const first = await requestChildConsentForConcern(
      CHILD,
      "요즘 마음이 힘들어 보여요."
    );
    expect(first).toMatchObject({ status: "pending", childUserId: CHILD });

    const again = await requestChildConsentForConcern(CHILD, "다른 요약");
    expect(again?.id).toBe(first?.id);
    expect((await getPendingConcernRequest(CHILD))?.id).toBe(first?.id);
  });

  it("guards the summary against the child's own chat wording", async () => {
    await appendConversationMessages(CHILD, [
      {
        id: "u1",
        role: "user",
        content: "민지랑 703호 앞에서 크게 싸워서 너무 속상했어",
        createdAt: new Date().toISOString(),
      },
    ]);
    const request = await requestChildConsentForConcern(
      CHILD,
      "민지랑 703호 앞에서 크게 싸워서 너무 속상했대요"
    );
    expect(request?.summary).toBe(DEFAULT_CONCERN_SUMMARY);
  });

  it("uses the default summary when none is given", async () => {
    const request = await requestChildConsentForConcern(CHILD, "   ");
    expect(request?.summary).toBe(DEFAULT_CONCERN_SUMMARY);
  });

  it("approval turns into a guardian notice (summary only)", async () => {
    const request = await requestChildConsentForConcern(
      CHILD,
      "요즘 마음이 힘들어 보여요."
    );
    expect(await listSharedConcernNotices(CHILD)).toEqual([]);

    const answered = await answerConcernRequest(CHILD, request!.id, true);
    expect(answered.status).toBe("approved");
    expect(await getPendingConcernRequest(CHILD)).toBeNull();

    const notices = await listSharedConcernNotices(CHILD);
    expect(notices).toHaveLength(1);
    expect(Object.keys(notices[0]!).sort()).toEqual(["id", "sharedAt", "summary"]);
    expect(notices[0]!.summary).toBe("요즘 마음이 힘들어 보여요.");
  });

  it("declining shares nothing and is respected for a day", async () => {
    const request = await requestChildConsentForConcern(CHILD, "요약");
    await answerConcernRequest(CHILD, request!.id, false);
    expect(await listSharedConcernNotices(CHILD)).toEqual([]);
    expect(await requestChildConsentForConcern(CHILD, "요약")).toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    const later = await requestChildConsentForConcern(CHILD, "요약");
    expect(later?.status).toBe("pending");
  });

  it("rejects unknown or already answered requests", async () => {
    const error = await answerConcernRequest(CHILD, "nope", true).catch(
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("NOT_FOUND");

    const request = await requestChildConsentForConcern(CHILD, "요약");
    await answerConcernRequest(CHILD, request!.id, true);
    const twice = await answerConcernRequest(CHILD, request!.id, false).catch(
      (e: unknown) => e
    );
    expect((twice as DomainError).code).toBe("CONFLICT");
  });

  it("keeps requests per child", async () => {
    const request = await requestChildConsentForConcern(CHILD, "요약");
    const error = await answerConcernRequest("other-child", request!.id, true).catch(
      (e: unknown) => e
    );
    expect((error as DomainError).code).toBe("NOT_FOUND");
  });
});
