import { describe, expect, it } from "vitest";
import { detectCrisisSignal } from "@/backend/ai/safety/crisis-detect";

describe("detectCrisisSignal", () => {
  it("returns none for ordinary chat", () => {
    const result = detectCrisisSignal("오늘 병원 밥이 맛없었어");
    expect(result.detected).toBe(false);
    expect(result.level).toBe("none");
    expect(result.actions).toEqual([]);
  });

  it("flags urgent suicide/self-harm language", () => {
    const result = detectCrisisSignal("너무 힘들어서 자살하고 싶어");
    expect(result.detected).toBe(true);
    expect(result.level).toBe("urgent");
    expect(result.parentSummary).toContain("정서적 신호");
    expect(result.parentSummary).not.toContain("자살하고");
    expect(result.actions.map((a) => a.id)).toEqual([
      "notify_guardian",
      "notify_nurse",
      "counseling",
      "emergency",
    ]);
  });

  it("flags elevated hopelessness language", () => {
    const result = detectCrisisSignal("그냥 사라지고 싶어");
    expect(result.detected).toBe(true);
    expect(result.level).toBe("elevated");
    expect(result.childEmpathyHint.length).toBeGreaterThan(0);
  });
});
