import { describe, expect, it } from "vitest";
import {
  DomainError,
  domainStatus,
} from "@/backend/shared/http/domain-error";

describe("DomainError → HTTP status contract", () => {
  it("defaults to VALIDATION → 400", () => {
    const error = new DomainError("잘못된 요청이에요.");
    expect(error.code).toBe("VALIDATION");
    expect(domainStatus(error)).toBe(400);
  });

  it.each([
    ["VALIDATION", 400],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["FORBIDDEN", 403],
  ] as const)("%s → %i", (code, status) => {
    const error = new DomainError("메시지", code);
    expect(domainStatus(error)).toBe(status);
  });
});
