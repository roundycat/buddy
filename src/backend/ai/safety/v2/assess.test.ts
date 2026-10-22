import { describe, expect, it } from "vitest";
import { assessChildMessage } from "./assess";
import { normalizeMessage } from "./normalize";
import { planSafetyResponse } from "./response";
import { mergeReviewedLevel } from "./llm-review";

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
    expect(plan.guardianAlert?.summary).toContain("대화 원문은 공유되지 않습니다");
    expect(plan.transparency).toBeTruthy();
  });
  it("keeps watch-level signals off the guardian screen", () => {
    const plan = planSafetyResponse(assessChildMessage({ text: "나 때문에 엄마가 맨날 울어" }));
    expect(plan.level).toBe("watch");
    expect(plan.guardianAlert).toBeUndefined();
    expect(plan.showPanel).toBe(false);
  });
});

describe("mergeReviewedLevel", () => {
  it("only raises", () => {
    expect(mergeReviewedLevel("none", "elevated")).toBe("elevated");
    expect(mergeReviewedLevel("urgent", "none")).toBe("urgent");
    expect(mergeReviewedLevel("watch", "protect")).toBe("protect");
    expect(mergeReviewedLevel("protect", "none")).toBe("protect");
    expect(mergeReviewedLevel("elevated", null)).toBe("elevated");
  });
});
