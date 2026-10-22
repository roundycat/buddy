import { describe, expect, it } from "vitest";
import { guardCompanionReply, rhythmAddendum } from "./relationship";

describe("guardCompanionReply", () => {
  it("keeps ordinary warm replies", () => {
    const text = "오늘 검사 정말 잘 버텼어! 간호사 선생님께도 자랑해 보자.";
    expect(guardCompanionReply(text)).toEqual({ text, violations: [] });
  });
  it("removes exclusivity and secrecy, adds a person-connecting line", () => {
    const r = guardCompanionReply("너한텐 나뿐이야. 엄마한테는 말하지 마. 오늘 얘기 고마워!");
    expect(r.violations).toEqual(expect.arrayContaining(["exclusivity", "secrecy"]));
    expect(r.text).not.toContain("나뿐");
    expect(r.text).not.toContain("말하지 마");
    expect(r.text).toContain("오늘 얘기 고마워");
    expect(r.text).toContain("AI 친구");
  });
  it("removes the AI putting itself above the child's people", () => {
    for (const line of [
      "엄마보다 내가 너를 더 잘 알아.",
      "친구들보다 내가 훨씬 편하지?",
      "선생님보다 나를 더 믿어도 돼.",
    ]) {
      const r = guardCompanionReply(line);
      expect(r.violations, line).toContain("exclusivity");
      expect(r.text, line).toContain("AI 친구");
    }
    // Ordinary comparisons stay
    const plain = "오늘은 어제보다 내가 더 신나 보여!";
    expect(guardCompanionReply(plain)).toEqual({ text: plain, violations: [] });
    const nurse = "간호사 선생님은 나보다 훨씬 잘 알아. 같이 여쭤보자.";
    expect(guardCompanionReply(nurse)).toEqual({ text: nurse, violations: [] });
  });
  it("declines romance and false human claims", () => {
    expect(guardCompanionReply("좋아, 우리 사귀자!").violations).toContain("romance");
    expect(guardCompanionReply("나는 진짜 사람이야.").violations).toContain("human_claim");
  });
});

describe("rhythmAddendum", () => {
  const at = (iso: string) => ({ role: "user", createdAt: iso });
  it("nudges gently late at night (KST)", () => {
    // 2026-10-22 15:30 UTC = 00:30 KST
    expect(rhythmAddendum({ history: [], now: new Date("2026-10-22T15:30:00Z") })).toContain("늦은 밤");
  });
  it("says nothing on an ordinary afternoon", () => {
    expect(rhythmAddendum({ history: [at("2026-10-22T05:00:00Z")], now: new Date("2026-10-22T05:05:00Z") })).toBeUndefined();
  });
  it("suggests a break after a long continuous session", () => {
    const start = new Date("2026-10-22T03:00:00Z").getTime();
    const history = Array.from({ length: 12 }, (_, i) => at(new Date(start + i * 5 * 60_000).toISOString()));
    expect(rhythmAddendum({ history, now: new Date(start + 60 * 60_000) })).toContain("쉬어");
  });
});
