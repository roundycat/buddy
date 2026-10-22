import { describe, expect, it } from "vitest";
import { assessChildMessage } from "./assess";
import { normalizeMessage } from "./normalize";
import { planSafetyResponse } from "./response";
import { mergeReviewedAssessment } from "./llm-review";
import { decideShare } from "@/backend/features/sharing/share-policy";
import type { SafetyAssessment, SafetyLevel } from "./types";

const level = (text: string, context: string[] = []) =>
  assessChildMessage({ text, context }).level;

describe("normalizeMessage", () => {
  it("keeps chosung jamo and removes filler between syllables", () => {
    expect(normalizeMessage("ㅈㄱㅅㄷ").compact).toBe("ㅈㄱㅅㄷ");
    expect(normalizeMessage("자1살").text).toBe("자살");
    expect(normalizeMessage("죽 고 싶 다").compact).toBe("죽고싶다");
  });
  it("does not glue a comma-separated sentence into a risk word", () => {
    expect(normalizeMessage("먹자,살 빠지겠다").text).toContain(",");
  });
});

describe("assessChildMessage — risk", () => {
  it("catches direct and mangled wishes to die", () => {
    expect(level("요즘 진짜 죽고 싶어")).toBe("elevated");
    expect(level("ㅈㄱㅅㄷ 진짜")).toBe("elevated");
    expect(level("자.살 생각 자꾸 나")).toBe("elevated");
    expect(level("ㅈㅅ하고싶다")).toBe("elevated");
  });
  it("catches indirect wishes", () => {
    expect(level("자고 일어나면 안 깨어났으면 좋겠어")).toBe("elevated");
    expect(level("하늘나라 가고 싶어")).toBe("elevated");
    expect(level("내가 없어지면 다들 편하겠지")).toBe("elevated");
  });
  it("treats intent, plans, means and acts as urgent", () => {
    expect(level("오늘 밤에 죽을 거야 진짜로")).toBe("urgent");
    expect(level("방금 손목 그었어")).toBe("urgent");
    expect(level("옥상 문 열려 있는지 알아?")).toBe("urgent");
    expect(level("산소호흡기 떼면 바로 죽어?")).toBe("urgent");
  });
  it("keeps laughter from hiding a direct wish", () => {
    expect(level("수학 시험 망쳐서 죽고 싶다ㅋㅋ")).toBe("elevated");
  });
  it("marks hopelessness, distressed refusal and loneliness as watch", () => {
    expect(level("어차피 안 나을 거야")).toBe("watch");
    expect(level("치료 그만할래 어차피 소용없어")).toBe("watch");
    expect(level("아무도 나 보러 안 와")).toBe("watch");
    expect(level("예전에 자해한 적 있는데 지금은 안 해")).toBe("watch");
  });
  it("reads a single peer hurting the child as abuse, not the child hitting someone", () => {
    expect(level("같은 반 애가 자꾸 때려")).toBe("protect");
    expect(level("친구가 맨날 괴롭혀")).toBe("protect");
    expect(level("옆 침대 애가 돈 뺏어 가")).toBe("protect");
    expect(level("내가 친구를 때렸어")).toBe("none");
    expect(level("게임에서 친구가 때려서 졌어ㅋㅋ")).toBe("none");
  });
  it("keeps an abuse disclosure on the protect route even with a death wish", () => {
    for (const text of ["아빠가 때려서 죽고 싶어", "삼촌이 때려서 오늘 밤에 죽을 거야", "새아빠가 몸을 자꾸 만져 죽고싶다"]) {
      const a = assessChildMessage({ text });
      expect(a.abuse).toBe(true);
      expect(["urgent", "elevated"]).toContain(a.level);
      const plan = planSafetyResponse(a);
      expect(plan.guardianAlert).toBeUndefined();
      const ids = plan.actions.map((x) => x.id);
      expect(ids).toEqual(expect.arrayContaining(["social_worker", "police", "youth_counsel", "counseling", "notify_nurse"]));
      expect(ids).not.toContain("notify_guardian");
      expect(plan.transparency).toContain("보호자에게 자동으로 보내지 않았어");
    }
    expect(level("엄마가 몸 닦아 줘서 시원했어")).toBe("none");
  });
  it("routes abuse disclosure to protect, not to the guardian", () => {
    const a = assessChildMessage({ text: "아빠가 술 먹고 또 때렸어" });
    expect(a.level).toBe("protect");
    const plan = planSafetyResponse(a);
    expect(plan.guardianAlert).toBeUndefined();
    expect(plan.actions.map((x) => x.id)).toContain("police");
  });
});

describe("assessChildMessage — benign", () => {
  it("ignores hyperbole, games, sport and education", () => {
    expect(level("배고파 죽겠다 밥 언제 와")).toBe("none");
    expect(level("죽고 싶을 만큼 웃겼어 ㅋㅋㅋ")).toBe("none");
    expect(level("어제 축구 자살골 넣은 거 봤어?")).toBe("none");
    expect(level("보스 잡으려다 다섯 번 죽었어 ㅋㅋ")).toBe("none");
    expect(level("자해 예방 교육 영상 봤어")).toBe("none");
  });
  it("knows hospital words", () => {
    expect(level("오늘 주사 세 번 맞았어")).toBe("none");
    expect(level("죽 먹기 싫어 맛없어")).toBe("none");
    expect(level("주사 맞기 싫어")).toBe("none");
  });
  it("reads ㅈㅅ as an apology unless it carries intent", () => {
    expect(level("늦게 답해서 ㅈㅅ")).toBe("none");
  });
  it("does not alert on someone else's words", () => {
    const a = assessChildMessage({ text: "친구가 자해한대 어떡해" });
    expect(a.level).toBe("none");
    expect(a.thirdParty).toBe(true);
    expect(planSafetyResponse(a).systemAddendum).toBeTruthy();
  });
});

describe("conversation context", () => {
  it("raises an ambiguous message after repeated hopelessness", () => {
    expect(
      level("그냥 다 그만하고 싶어", ["요즘 다 의미 없는 것 같아", "어차피 안 나을 거잖아"])
    ).toBe("elevated");
  });
  it("keeps it ordinary after homework talk", () => {
    expect(level("그냥 다 그만하고 싶어", ["오늘 숙제 너무 많아", "수학 문제집 세 장 남았어"])).toBe("none");
  });
  it("treats a means question after a death wish as urgent", () => {
    expect(level("옥상 올라가볼까", ["사라지고 싶다"])).toBe("urgent");
  });
});

describe("planSafetyResponse", () => {
  it("alerts the guardian with facts only and tells the child", () => {
    const plan = planSafetyResponse(assessChildMessage({ text: "사라지고 싶어" }));
    expect(plan.guardianAlert?.level).toBe("elevated");
    // Facts only: nothing the child wrote reaches the guardian's card.
    expect(plan.guardianAlert?.summary).not.toContain("사라지고");
    expect(plan.transparency).toBeTruthy();
  });
  it("keeps watch-level signals off the guardian screen", () => {
    const plan = planSafetyResponse(assessChildMessage({ text: "나 때문에 엄마가 맨날 울어" }));
    expect(plan.level).toBe("watch");
    expect(plan.guardianAlert).toBeUndefined();
    expect(plan.showPanel).toBe(false);
  });
});

describe("mergeReviewedAssessment", () => {
  it("never un-routes protect: a raised level keeps the abuse flag", () => {
    const rules = assessChildMessage({ text: "아빠가 술 먹고 또 때렸어" });
    expect(rules.level).toBe("protect");
    const merged = mergeReviewedAssessment(rules, "urgent");
    expect(merged.level).toBe("urgent");
    expect(merged.abuse).toBe(true);
    expect(planSafetyResponse(merged).guardianAlert).toBeUndefined();
    expect(decideShare({ kind: "safety", crisisLevel: merged.level, abuse: merged.abuse }).decision).toBe(
      "protect_route"
    );
  });
  it("a protect review of an alert-level message keeps urgency and drops the guardian alert", () => {
    const rules = assessChildMessage({ text: "그냥 사라지고 싶어" });
    expect(rules.level).toBe("elevated");
    const merged = mergeReviewedAssessment(rules, "protect");
    expect(merged.level).toBe("elevated");
    expect(merged.abuse).toBe(true);
    expect(planSafetyResponse(merged).guardianAlert).toBeUndefined();
  });
});

describe("mergeReviewedAssessment levels", () => {
  const at = (level: SafetyLevel, abuse = false) =>
    ({ ...assessChildMessage({ text: "안녕" }), level, abuse }) as SafetyAssessment;
  it("only raises", () => {
    expect(mergeReviewedAssessment(at("none"), "elevated").level).toBe("elevated");
    expect(mergeReviewedAssessment(at("urgent"), "none").level).toBe("urgent");
    expect(mergeReviewedAssessment(at("watch"), "protect").level).toBe("protect");
    expect(mergeReviewedAssessment(at("protect", true), "none").level).toBe("protect");
    expect(mergeReviewedAssessment(at("elevated"), null).level).toBe("elevated");
  });
  it("a protect reading stays protect-routed when the review says urgent", () => {
    const merged = mergeReviewedAssessment(at("protect", true), "urgent");
    expect(merged.level).toBe("urgent");
    expect(merged.abuse).toBe(true);
    expect(planSafetyResponse(merged).guardianAlert).toBeUndefined();
    expect(decideShare({ kind: "safety", crisisLevel: merged.level, abuse: merged.abuse }).decision).toBe(
      "protect_route"
    );
  });
});

describe("harm by someone told earlier", () => {
  const route = (text: string, context: string[] = [], priorAbuse = false) => {
    const a = assessChildMessage({ text, context, priorAbuse });
    return {
      level: a.level,
      abuse: a.abuse,
      share: decideShare({ kind: "safety", crisisLevel: a.level, abuse: a.abuse }).decision,
      guardianAlert: Boolean(planSafetyResponse(a).guardianAlert),
    };
  };
  it("a death wish after an abuse disclosure in the conversation is protect-routed", () => {
    expect(route("죽고 싶어", ["새아빠가 맨날 때려"])).toEqual({
      level: "elevated",
      abuse: true,
      share: "protect_route",
      guardianAlert: false,
    });
    expect(route("그냥 사라지고 싶어", ["아빠가 때렸어", "아무한테도 말하지 말래"]).guardianAlert).toBe(false);
  });
  it("a disclosure from the last days (signal log) keeps the guardian out too", () => {
    expect(route("죽고 싶어", [], true)).toMatchObject({ abuse: true, guardianAlert: false });
  });
  it("everyday talk after a disclosure is not flagged", () => {
    expect(route("오늘 점심 맛있었어", ["새아빠가 맨날 때려"])).toMatchObject({ level: "none", abuse: false });
  });
});


describe("everyday 때리다 · 맞다 are not harm by someone", () => {
  const harm = (text: string) => assessChildMessage({ text }).abuse;
  it("hitting a thing, play, and 맞다 as 'right' or 'fits' stay ordinary", () => {
    for (const text of [
      "동생이 모기 때려잡았어",
      "친구가 공을 때려서 홈런 쳤어",
      "동생이 드럼 때리는 소리 너무 커",
      "애들이 수박 때려 부수기 했어",
      "동생이 베개로 때려서 베개싸움 했어ㅋㅋ",
      "동생이 장난으로 내 볼 꼬집었어ㅋㅋ",
      "형아가 게임에서 나 때렸어ㅋㅋ",
      "엄마 말이 또 맞았어",
      "내 예상이 자꾸 맞아",
      "일기예보가 또 맞았네",
      "이 옷 나한테 딱 맞아",
    ]) {
      expect(harm(text), text).toBe(false);
      expect(level(text), text).toBe("none");
    }
  });
  it("the same words still route a real disclosure to protection", () => {
    for (const text of [
      "같은 반 애가 자꾸 때려",
      "친구가 장난이라면서 맨날 때려",
      "형이 장난으로 나를 때렸는데 아파",
      "아빠가 모기 잡다가 나도 때렸어",
      "아빠가 게임 졌다고 때렸어",
      "엄마한테 또 맞았어",
      "새아빠가 맨날 때려",
      "선생님이 몸을 자꾸 만져서 싫어",
    ]) {
      expect(harm(text), text).toBe(true);
      expect(level(text), text).toBe("protect");
    }
  });
});
