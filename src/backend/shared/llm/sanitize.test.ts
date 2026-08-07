import { describe, expect, it } from "vitest";
import {
  createStreamingNameFilter,
  fillNamePlaceholders,
  fillNamePlaceholdersDeep,
  hasNamePlaceholder,
} from "./sanitize";

describe("fillNamePlaceholders — 받침 있는 이름", () => {
  const name = "지민";

  it("subject particle takes the 이 suffix", () => {
    expect(fillNamePlaceholders("{NAME}가 왔어", name)).toBe("지민이가 왔어");
    expect(fillNamePlaceholders("{NAME}이가 왔어", name)).toBe("지민이가 왔어");
  });

  it("topic / object particles too", () => {
    expect(fillNamePlaceholders("{NAME}는 소중해", name)).toBe("지민이는 소중해");
    expect(fillNamePlaceholders("{NAME}은 소중해", name)).toBe("지민이는 소중해");
    expect(fillNamePlaceholders("{NAME}를 응원해", name)).toBe("지민이를 응원해");
    expect(fillNamePlaceholders("{NAME}을 응원해", name)).toBe("지민이를 응원해");
  });

  it("vocative flips to 아", () => {
    expect(fillNamePlaceholders("{NAME}야, 안녕", name)).toBe("지민아, 안녕");
  });

  it("dative and comitative", () => {
    expect(fillNamePlaceholders("{NAME}한테 줄게", name)).toBe("지민이한테 줄게");
    expect(fillNamePlaceholders("{NAME}에게 줄게", name)).toBe("지민이에게 줄게");
    expect(fillNamePlaceholders("{NAME}랑 놀자", name)).toBe("지민이랑 놀자");
    expect(fillNamePlaceholders("{NAME}와 놀자", name)).toBe("지민이와 놀자");
  });

  it("bare placeholder gets the 이 suffix", () => {
    expect(fillNamePlaceholders("{NAME}이 그린 그림", name)).toBe(
      "지민이 그린 그림"
    );
  });
});

describe("fillNamePlaceholders — 받침 없는 이름", () => {
  const name = "수아";

  it("drops the 이 suffix", () => {
    expect(fillNamePlaceholders("{NAME}이가 왔어", name)).toBe("수아가 왔어");
    expect(fillNamePlaceholders("{NAME}이는 소중해", name)).toBe("수아는 소중해");
    expect(fillNamePlaceholders("{NAME}이를 응원해", name)).toBe("수아를 응원해");
    expect(fillNamePlaceholders("{NAME}이한테 줄게", name)).toBe("수아한테 줄게");
  });

  it("vocative stays 야", () => {
    expect(fillNamePlaceholders("{NAME}아, 안녕", name)).toBe("수아야, 안녕");
  });

  it("bare placeholder adds nothing", () => {
    expect(fillNamePlaceholders("{NAME}이 그린 그림", name)).toBe(
      "수아 그린 그림"
    );
  });
});

describe("fillNamePlaceholders — 표기 변형", () => {
  it("handles brace, bracket, angle and template forms", () => {
    expect(fillNamePlaceholders("{{name}}가", "지민")).toBe("지민이가");
    expect(fillNamePlaceholders("${childName}가", "지민")).toBe("지민이가");
    expect(fillNamePlaceholders("[NAME]가", "지민")).toBe("지민이가");
    expect(fillNamePlaceholders("<child_name>가", "지민")).toBe("지민이가");
    expect(fillNamePlaceholders("{이름}가", "지민")).toBe("지민이가");
    expect(fillNamePlaceholders("{ NAME }가", "지민")).toBe("지민이가");
  });

  it("replaces every occurrence", () => {
    expect(
      fillNamePlaceholders("{NAME}가 원하는 걸 {NAME}는 알아", "지민")
    ).toBe("지민이가 원하는 걸 지민이는 알아");
  });
});

describe("fillNamePlaceholders — Latin names", () => {
  it("treats a final consonant like a 받침", () => {
    expect(fillNamePlaceholders("{NAME}가", "Kevin")).toBe("Kevin이가");
    expect(fillNamePlaceholders("{NAME}가", "Leo")).toBe("Leo가");
  });
});

describe("fillNamePlaceholders — 이름이 없을 때", () => {
  it("drops the placeholder and its particle", () => {
    expect(fillNamePlaceholders("{NAME}이가 원하는 게 좋아")).toBe(
      "원하는 게 좋아"
    );
  });

  it("never leaves a dangling 이 behind", () => {
    expect(fillNamePlaceholders("오늘 {NAME}는 잘 잤어")).not.toContain("이");
  });
});

describe("fillNamePlaceholders — 오탐 방지", () => {
  it("leaves text without a placeholder untouched", () => {
    const text = '{"mood":"hope","reason":"오늘도 괜찮아"}';
    expect(fillNamePlaceholders(text, "지민")).toBe(text);
  });

  it("keeps 이-initial words as words", () => {
    expect(fillNamePlaceholders("{NAME}이제 괜찮아", "지민")).toBe(
      "지민이제 괜찮아"
    );
  });

  it("recognises a placeholder only where one exists", () => {
    expect(hasNamePlaceholder("지민이가 왔어")).toBe(false);
    expect(hasNamePlaceholder("{NAME}이가 왔어")).toBe(true);
  });

  it("does not treat a JSON key as a placeholder", () => {
    const json = '{"name": "지민", "note": "괜찮아"}';
    expect(fillNamePlaceholders(json, "지민")).toBe(json);
  });
});

describe("fillNamePlaceholdersDeep", () => {
  it("walks nested payloads", () => {
    const payload = {
      letters: [{ title: "{NAME}에게", body: "{NAME}가 좋아" }],
      count: 1,
    };
    expect(fillNamePlaceholdersDeep(payload, "지민")).toEqual({
      letters: [{ title: "지민이에게", body: "지민이가 좋아" }],
      count: 1,
    });
  });

  it("returns the same reference when nothing changed", () => {
    const payload = { body: "오늘도 괜찮아" };
    expect(fillNamePlaceholdersDeep(payload, "지민")).toBe(payload);
  });
});

describe("createStreamingNameFilter", () => {
  it("resolves a placeholder split across chunks", () => {
    const filter = createStreamingNameFilter("지민");
    const chunks = ["오늘 ", "{NA", "ME}", "가 ", "왔어. 정말 반가워 반가워."];
    const out = chunks.map((c) => filter.push(c)).join("") + filter.flush();
    expect(out).toBe("오늘 지민이가 왔어. 정말 반가워 반가워.");
  });

  it("passes plain text straight through", () => {
    const filter = createStreamingNameFilter("지민");
    const out = filter.push("안녕, 오늘 하루는 어땠어?") + filter.flush();
    expect(out).toBe("안녕, 오늘 하루는 어땠어?");
  });
});
