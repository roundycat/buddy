import { describe, expect, it } from "vitest";
import { DomainError, HttpError, withApiGuard } from "@/backend/shared/http/route";
import { UnauthorizedError } from "@/backend/shared/http/auth";

async function readJson(res: Response) {
  return {
    status: res.status,
    body: await res.json(),
  };
}

describe("withApiGuard DomainError → HTTP contract", () => {
  it("returns handler JSON on success", async () => {
    const res = await withApiGuard(
      async () => ({ ok: true }),
      "실패",
      "[test]"
    );
    expect(await readJson(res)).toEqual({
      status: 200,
      body: { ok: true },
    });
  });

  it.each([
    ["VALIDATION", 400],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["FORBIDDEN", 403],
  ] as const)("%s → { error } with %i", async (code, status) => {
    const res = await withApiGuard(
      async () => {
        throw new DomainError("도메인 오류", code);
      },
      "실패",
      "[test]"
    );
    expect(await readJson(res)).toEqual({
      status,
      body: { error: "도메인 오류" },
    });
  });

  it("maps HttpError status", async () => {
    const res = await withApiGuard(
      async () => {
        throw new HttpError("잘못된 요청", 422);
      },
      "실패",
      "[test]"
    );
    expect(await readJson(res)).toEqual({
      status: 422,
      body: { error: "잘못된 요청" },
    });
  });

  it("maps UnauthorizedError", async () => {
    const res = await withApiGuard(
      async () => {
        throw new UnauthorizedError();
      },
      "실패",
      "[test]"
    );
    const { status, body } = await readJson(res);
    expect(status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("uses fallback for unknown errors", async () => {
    const res = await withApiGuard(
      async () => {
        throw new Error("boom");
      },
      "잠시 후 다시 시도해 주세요.",
      "[test]",
      503
    );
    expect(await readJson(res)).toEqual({
      status: 503,
      body: { error: "잠시 후 다시 시도해 주세요." },
    });
  });
});
