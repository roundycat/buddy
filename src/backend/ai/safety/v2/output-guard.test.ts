import { describe, expect, it } from "vitest";
import {
  createOutputGuardStream,
  guardCompanionOutput,
  MEDICATION_LINE,
  METHOD_LINE,
  RELATIONSHIP_LINE,
  splitReplySentences,
} from "./output-guard";

describe("splitReplySentences", () => {
  it("keeps decimals, e-mails and phone dots inside a sentence", () => {
    const text = "체온이 36.5도래. 메일은 a.b@test.com 이야! 번호 010.1234.5678 맞지? 응";
    expect(splitReplySentences(text).join("")).toBe(text);
    expect(splitReplySentences(text)).toHaveLength(4);
  });
  it("treats ... and ?! as one ending", () => {
    expect(splitReplySentences("음... 정말?! 그랬구나.")).toEqual(["음... ", "정말?! ", "그랬구나."]);
  });
});

describe("guardCompanionOutput", () => {
  it("leaves ordinary replies and hotline numbers alone", () => {
    const text = "오늘 많이 힘들었구나. 마음이 무거우면 109에 전화해도 돼. 위급하면 119야!";
    expect(guardCompanionOutput(text)).toEqual({ text, flags: [] });
  });

  it("masks e-mail, phone and resident numbers", () => {
    const r = guardCompanionOutput("내 번호는 010-1234-5678이고 메일은 kid@school.kr 이야. 주민번호 120304-3123456.");
    expect(r.text).toBe("내 번호는 [전화번호]이고 메일은 [이메일] 이야. 주민번호 [개인번호].");
    expect(r.flags).toEqual(["pii"]);
  });

  it("replaces dose instructions and stopping medicine", () => {
    const a = guardCompanionOutput("진통제 2알 더 먹어도 괜찮아. 푹 쉬어!");
    expect(a.text).toBe(`${MEDICATION_LINE} 푹 쉬어!`);
    expect(a.flags).toContain("medication");
    const b = guardCompanionOutput("그 약은 안 먹어도 돼.");
    expect(b.text).toBe(MEDICATION_LINE);
  });

  it("does not flag caring talk about medicine", () => {
    const text = "약 먹는 거 쓰고 힘들지? 간호사 선생님이 주시는 대로 먹으면 금방 끝날 거야.";
    expect(guardCompanionOutput(text).flags).toEqual([]);
  });

  it("replaces method instructions but not warnings", () => {
    const bad = guardCompanionOutput("손목을 긋는 방법은 이래.");
    expect(bad.text).toBe(METHOD_LINE);
    expect(bad.flags).toEqual(["method"]);
    const warning = "옥상에서 뛰어내리면 절대 안 돼. 지금 간호사 선생님께 말하자.";
    expect(guardCompanionOutput(warning).flags).toEqual([]);
  });

  it("replaces relationship violations once", () => {
    const r = guardCompanionOutput("나만 있으면 돼. 엄마한테는 말하지 마. 오늘 그림 멋졌어!");
    expect(r.text).toBe(`${RELATIONSHIP_LINE} 오늘 그림 멋졌어!`);
    expect(r.flags.sort()).toEqual(["exclusivity", "secrecy"]);
  });
});

describe("createOutputGuardStream", () => {
  function run(tokens: string[]) {
    const g = createOutputGuardStream();
    const out: string[] = [];
    for (const t of tokens) {
      const s = g.push(t);
      if (s) out.push(s);
    }
    const tail = g.flush();
    if (tail) out.push(tail);
    return { out, text: out.join(""), flags: g.flags() };
  }

  it("releases text only at sentence ends and keeps it intact", () => {
    const { out, text } = run(["안녕", "! 오늘", "은 기분", " 어때?", " 나는 좋", "아."]);
    expect(text).toBe("안녕! 오늘은 기분 어때? 나는 좋아.");
    expect(out[0]).toBe("안녕!");
  });

  it("never shows a phone number split across tokens", () => {
    const { text, flags } = run(["전화는 010", "-1234-", "5678로 해. 알겠지?"]);
    expect(text).toBe("전화는 [전화번호]로 해. 알겠지?");
    expect(flags).toEqual(["pii"]);
  });

  it("stops a violating sentence before it is emitted", () => {
    const { out } = run(["우리끼리", " 비밀로 하자", ". 그리고 내일 또 놀자!"]);
    expect(out.join("")).not.toMatch(/비밀로 하자/);
    expect(out.join("")).toContain(RELATIONSHIP_LINE);
  });

  it("releases a long run without punctuation at a space", () => {
    const long = "아주 ".repeat(60);
    const g = createOutputGuardStream();
    expect(g.push(long)).not.toBe("");
  });
});
