import { describe, expect, it } from "vitest";
import { detectLeak, guardGuardianText } from "./leak-guard";

describe("detectLeak — verbatim", () => {
  it("flags 4+ consecutive eojeol copied from the child, across 조사 changes", () => {
    const child = ["어제 병원 놀이터에서 민지랑 크게 싸워서 너무 속상했어"];
    const check = detectLeak(
      "어제 병원 놀이터에서 민지와 크게 다툰 일이 있었대요.",
      child
    );
    expect(check.leak).toBe(true);
    expect(check.types).toContain("verbatim");
    expect(check.spans.some((s) => s.includes("놀이터에서"))).toBe(true);
  });

  it("flags 12+ consecutive Hangul characters even when spacing differs", () => {
    const child = ["엄마가퇴원하면놀이공원에꼭데려가준다고약속했어!!"];
    const check = detectLeak(
      "엄마가 퇴원하면 놀이공원에 꼭 데려가 준다고 약속했어요.",
      child
    );
    expect(check.types).toContain("verbatim");
  });

  it("normalises punctuation, emoji and jamo noise", () => {
    const child = ["집에 가고 싶어.. 엄마 보고 싶고 ㅠㅠ 병원 밥도 맛없고 😢"];
    const check = detectLeak("집에가고싶어, 엄마 보고싶고 병원밥도 맛없고", child);
    expect(check.types).toContain("verbatim");
  });

  it("normalises full-width forms (NFKC)", () => {
    const child = ["ＡＢＣ 놀이터에서 친구들이랑 숨바꼭질하면서 신나게 놀았어"];
    const check = detectLeak(
      "놀이터에서 친구들이랑 숨바꼭질하면서 신나게 놀았대요",
      child
    );
    expect(check.types).toContain("verbatim");
  });

  it("does not flag short generic phrases", () => {
    const child = ["오늘 정말 너무 좋았어", "고마워 베디야", "응 괜찮아"];
    expect(
      detectLeak("오늘은 정말 너무 좋았던 하루였어요. 고마운 마음이 느껴져요.", child)
        .leak
    ).toBe(false);
  });

  it("does not flag an ordinary summary of the same day", () => {
    const child = ["오늘 주사 맞았는데 진짜 아팠어 근데 참았어"];
    const check = detectLeak(
      "오늘은 치료 일정이 있었고, 끝까지 잘 견뎌 낸 하루였어요.",
      child
    );
    expect(check.leak).toBe(false);
  });
});

describe("detectLeak — quote", () => {
  it("flags quoted child wording", () => {
    const child = ["아무도 나를 안 좋아해"];
    const check = detectLeak(
      "아이가 “아무도 나를 안 좋아해”라고 말했어요.",
      child
    );
    expect(check.types).toContain("quote");
    expect(check.spans).toContain("아무도 나를 안 좋아해");
  });

  it("flags reported speech (…다고 했어요) carrying child wording", () => {
    const child = ["집에 가고 싶어"];
    const check = detectLeak("아이가 집에 가고 싶다고 했어요.", child);
    expect(check.types).toContain("quote");
  });

  it("flags hearsay endings (…했대요) carrying child wording", () => {
    const child = ["민수가 내 그림 보고 놀려서 서러웠어"];
    const check = detectLeak("민수가 그림 보고 놀려서 서러웠대요.", child);
    expect(check.types).toContain("quote");
  });

  it("ignores quotes that are not the child's words", () => {
    const child = ["하늘 보기 했어", "심심해"];
    const check = detectLeak(
      "오늘 해낸 “창밖 하늘 보기” 이야기를 같이 들어 주세요.",
      child
    );
    expect(check.types).not.toContain("quote");
    expect(check.leak).toBe(false);
  });
});

describe("detectLeak — secret", () => {
  it("flags content from a message the child marked secret", () => {
    const child = ["엄마한테는 비밀인데 나 수학 시험 완전 망쳤어"];
    const check = detectLeak(
      "요즘 수학 시험 때문에 마음이 무거워 보여요.",
      child
    );
    expect(check.types).toContain("secret");
  });

  it("flags secrets marked with 몰래 / 말하지 마", () => {
    const child = ["아빠한테 말하지 마, 어젯밤에 몰래 과자 먹었어"];
    const check = detectLeak("어젯밤에 과자를 먹은 것 같아요.", child);
    expect(check.types).toContain("secret");
  });

  it("matches inflected verbs from a secret (울었어 → 울었다고)", () => {
    const child = ["엄마한테는 비밀인데, 나 사실 무서워서 몰래 울었어"];
    const check = detectLeak("아이가 몰래 울었다고 해요.", child);
    expect(check.types).toContain("secret");
  });

  it("does not flag when the secret content is absent", () => {
    const child = ["비밀인데 나 수학 시험 망쳤어"];
    expect(detectLeak("오늘은 차분하게 쉬었어요.", child).leak).toBe(false);
  });

  it("does not treat unmarked messages as secrets", () => {
    const child = ["수학 시험 망쳤어"];
    expect(
      detectLeak("시험 이야기가 나오면 천천히 들어 주세요.", child).types
    ).not.toContain("secret");
  });

  it("ignores 비밀번호", () => {
    const child = ["비밀번호 까먹었어 태블릿"];
    expect(
      detectLeak("태블릿 사용 시간을 함께 정해 보세요.", child).types
    ).not.toContain("secret");
  });
});

describe("detectLeak — third_party_name", () => {
  it.each([
    [["민지랑 싸웠어 진짜 짜증나"], "민지와의 일로 속상해했어요."],
    [["지훈이한테 문자 왔어"], "지훈 군과 연락하며 기운을 냈어요."],
    [["박지훈 선생님이 좋아"], "박지훈 선생님 덕분에 마음이 편했대요."],
    [["김OO 간호사 쌤이 주사 놔줬어"], "김OO 간호사님이 잘 챙겨 주셨어요."],
    [["친구 서연 보고 싶다"], "서연이를 그리워하는 마음이 있어요."],
    [["김민지가 문병 온대"], "민지가 찾아온다는 소식에 설렜어요."],
  ])("flags a name the child used: %s", (child, guardian) => {
    const check = detectLeak(guardian, child);
    expect(check.types).toContain("third_party_name");
  });

  it("allows generic roles", () => {
    const child = [
      "간호사 선생님이 친절했어",
      "친구랑 놀았어",
      "엄마한테 혼났어",
      "친절한 간호사 쌤이 좋아",
    ];
    const check = detectLeak(
      "친절한 간호사 선생님과 친구 이야기를 하며 웃었어요. 엄마와도 이야기를 나눠 보세요.",
      child
    );
    expect(check.types).not.toContain("third_party_name");
    expect(check.leak).toBe(false);
  });

  it("does not mistake everyday nouns for names", () => {
    const child = ["주사가 너무 아팠어", "정원이 예뻐", "하루가 길었어", "일기를 썼어"];
    const check = detectLeak(
      "주사를 맞을 때 힘들었을 수 있어요. 감정 정원과 일기를 함께 보며 하루를 정리해 보세요.",
      child
    );
    expect(check.types).not.toContain("third_party_name");
  });

  it("treats a name-like word used as a verb as a verb", () => {
    const child = ["지원이랑 게임했어"];
    expect(detectLeak("정서적으로 지원해 주세요.", child).leak).toBe(false);
    expect(detectLeak("지원이와 게임하며 즐거웠대요.", child).types).toContain(
      "third_party_name"
    );
  });

  it("does not flag a name that only the guardian text contains", () => {
    expect(
      detectLeak("민지와 함께 웃었어요.", ["오늘 재밌었어"]).types
    ).not.toContain("third_party_name");
  });
});

describe("detectLeak — location", () => {
  it.each([
    "703호 병실에서 조용히 쉬었어요.",
    "7층 병실 창가에서 하늘을 봤어요.",
    "서울시 강남구 역삼동 근처 이야기를 했어요.",
    "역삼동 123-4 근처예요.",
    "테헤란로 123 쪽으로 산책했어요.",
    "좌표 37.5665, 126.9780 근처였어요.",
    "５병동에서 지냈어요.",
  ])("flags %s", (guardian) => {
    const check = detectLeak(guardian, []);
    expect(check.types).toEqual(["location"]);
  });

  it.each([
    "앞으로 3일 동안 천천히 쉬어요.",
    "1호선을 타고 오셨대요.",
    "작은 모험을 3가지 해냈어요.",
    "새로 2개의 소원을 걸었어요.",
  ])("does not flag %s", (guardian) => {
    expect(detectLeak(guardian, []).leak).toBe(false);
  });
});

describe("detectLeak — shape", () => {
  it("returns no leak for empty text", () => {
    expect(detectLeak("", ["민지랑 싸웠어"])).toEqual({
      leak: false,
      types: [],
      spans: [],
    });
  });

  it("reports several types in a stable order", () => {
    const child = ["엄마한테 비밀인데 민지랑 703호 앞에서 크게 싸워서 진짜 속상했어"];
    const check = detectLeak(
      "민지랑 703호 앞에서 크게 싸워서 진짜 속상했대요.",
      child
    );
    expect(check.leak).toBe(true);
    expect(check.types[0]).toBe("verbatim");
    expect(check.types).toContain("third_party_name");
    expect(check.types[check.types.length - 1]).toBe("location");
  });
});

describe("guardGuardianText", () => {
  const child = ["민지랑 싸웠어"];

  it("returns the fallback when the text leaks", () => {
    const fallback = "오늘은 친구 관계로 마음이 조금 쓰였을 수 있어요.";
    const result = guardGuardianText("민지와 다퉈서 속상했대요.", child, fallback);
    expect(result.text).toBe(fallback);
    expect(result.check.leak).toBe(true);
    expect(result.check.types).toContain("third_party_name");
  });

  it("keeps clean text untouched", () => {
    const text = "오늘은 친구와의 일로 마음이 쓰였을 수 있어요.";
    const result = guardGuardianText(text, child, "fallback");
    expect(result).toEqual({
      text,
      check: { leak: false, types: [], spans: [] },
    });
  });
});
