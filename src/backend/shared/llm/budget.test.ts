import { afterEach, describe, expect, it } from "vitest";
import { dailyBudgetStatus, resetDailyBudget, takeDailyBudget } from "./budget";
import { allowRequest, resetRateLimits } from "@/backend/shared/http/rate-limit";

afterEach(() => {
  delete process.env.AI_DAILY_LLM_CAP;
  resetDailyBudget();
  resetRateLimits();
});

describe("daily AI budget", () => {
  it("stops at the cap and resets on the next KST day", () => {
    process.env.AI_DAILY_LLM_CAP = "2";
    const day1 = new Date("2026-10-22T03:00:00Z");
    expect(takeDailyBudget("llm", day1)).toBe(true);
    expect(takeDailyBudget("llm", day1)).toBe(true);
    expect(takeDailyBudget("llm", day1)).toBe(false);
    expect(dailyBudgetStatus(day1).llm.used).toBe(2);
    expect(takeDailyBudget("llm", new Date("2026-10-22T16:00:00Z"))).toBe(true); // 01:00 KST next day
  });
  it("treats 0 as no cap", () => {
    process.env.AI_DAILY_LLM_CAP = "0";
    for (let i = 0; i < 10; i++) expect(takeDailyBudget("llm")).toBe(true);
  });
});

describe("allowRequest", () => {
  it("enforces every window", () => {
    const limits = [{ windowMs: 1000, max: 2 }];
    expect(allowRequest("k", limits, 0)).toBe(true);
    expect(allowRequest("k", limits, 10)).toBe(true);
    expect(allowRequest("k", limits, 20)).toBe(false);
    expect(allowRequest("k", limits, 1500)).toBe(true);
  });
});
