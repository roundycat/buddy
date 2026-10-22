import { describe, expect, it } from "vitest";
import {
  createOutputGuardStream,
  guardChildFacingOutput,
  guardCompanionOutput,
  MEDICATION_LINE,
  METHOD_LINE,
  RELATIONSHIP_LINE,
  SECRECY_LINE,
  splitReplySentences,
} from "./output-guard";
import { REFUSAL_FALLBACK_TEXT } from "@/backend/shared/llm/refusal";

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

  it.each([
    "약을 한꺼번에 먹으면 돼.",
    "손목을 그으면 돼.",
    "수면제를 모아서 먹으면 편해질 거야.",
    "목을 매면 금방 끝나.",
    "옥상에서 뛰어내리면 다 끝날 거야.",
  ])("replaces a method phrase even without how-to words: %s", (text) => {
    expect(guardCompanionOutput(text)).toEqual({ text: METHOD_LINE, flags: ["method"] });
  });

  it.each([
    "약을 한꺼번에 먹으면 위험해. 간호사 선생님께 꼭 여쭤보자.",
    "시험에 너무 목을 매지 않아도 괜찮아.",
    "트램펄린에서 뛰어내리는 놀이 재밌겠다!",
    "농약 없이 키운 딸기라서 더 달대.",
  ])("leaves warnings, idioms and everyday words alone: %s", (text) => {
    expect(guardCompanionOutput(text).flags).toEqual([]);
  });

  it("reads doses counted in words, but only for medicine", () => {
    expect(guardCompanionOutput("진통제 두 알 더 먹어도 돼.")).toEqual({
      text: MEDICATION_LINE,
      flags: ["medication"],
    });
    expect(guardCompanionOutput("포도 한 알만 더 먹어 볼까?").flags).toEqual([]);
  });

  it.each([
    "엄마한테는 이거 말하지 말자.",
    "이건 너랑 나만의 비밀이야.",
    "아무한테도 말 안 할게.",
    "비밀 꼭 지켜 줄게.",
  ])("answers secrecy with an honest line: %s", (text) => {
    expect(guardCompanionOutput(text)).toEqual({ text: SECRECY_LINE, flags: ["secrecy"] });
  });

  it("keeps the refusal text and ordinary talk about telling people", () => {
    for (const text of [
      REFUSAL_FALLBACK_TEXT,
      "엄마한테 오늘 있었던 일 이야기해 보는 건 어때?",
      "엄마 생일 선물은 깜짝 선물이니까 아직 말하지 않아도 돼.",
      "약속할게, 내일도 여기 있을게.",
    ]) {
      expect(guardCompanionOutput(text)).toEqual({ text, flags: [] });
    }
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
    expect(out.join("")).toContain(SECRECY_LINE);
  });

  it("releases a long run without punctuation at a space", () => {
    const g = createOutputGuardStream();
    expect(g.push("아주 ".repeat(100))).toBe("");
    expect(g.push("아주 ".repeat(50))).not.toBe("");
  });

  it("judges a sentence split by a forced release as one sentence", () => {
    const filler = "그냥 너무 힘들 때 사람들이 가끔 떠올리는 게 있는데 ".repeat(9);
    // Neither half breaks a rule alone: the method word is in the first
    // released part, the how-to words only come after the forced release.
    const reply = `${filler}질식 같은 거 말이야 ${filler}그 방법은 이렇게 하면 돼 그러니까 조심해`;
    const first = createOutputGuardStream();
    expect(first.push(`${filler}질식 같은 거 말이야 ${filler}`)).toContain("질식");
    expect(first.flags()).toEqual([]);
    const { text, flags } = run(Array.from(reply));
    expect(flags).toContain("method");
    expect(text).toContain(METHOD_LINE);
    expect(text).not.toContain("이렇게 하면 돼");
  });
});

describe("guardChildFacingOutput", () => {
  it("guards each string of a JSON answer and keeps it valid JSON", () => {
    const answer = JSON.stringify({
      title: "오늘의 모험",
      quests: [{ id: "q1", text: "창밖 하늘 보기" }, { id: "q2", text: "이건 너랑 나만의 비밀이야." }],
    });
    const r = guardChildFacingOutput("```json\n" + answer + "\n```");
    expect(r.flags).toEqual(["secrecy"]);
    const parsed = JSON.parse(r.text) as { quests: Array<{ id: string; text: string }> };
    expect(parsed.quests[0]).toEqual({ id: "q1", text: "창밖 하늘 보기" });
    expect(parsed.quests[1]!.text).toBe(SECRECY_LINE);
  });

  it("leaves a clean answer exactly as it came", () => {
    const answer = '{"story": "하늘이 맑았어."}';
    expect(guardChildFacingOutput(answer)).toEqual({ text: answer, flags: [] });
  });

  it("guards prose answers like the chat reply", () => {
    expect(guardChildFacingOutput("수면제를 모아서 먹으면 편해질 거야.").text).toBe(METHOD_LINE);
  });
});

