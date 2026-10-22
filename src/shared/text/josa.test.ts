import { describe, expect, it } from "vitest";
import {
  callName,
  copulaParticle,
  object,
  objectParticle,
  politeIs,
  subject,
  subjectParticle,
  topic,
  topicParticle,
  withAnd,
  withRo,
} from "./josa";

describe("josa", () => {
  it("picks 은/는 and 이/가 by the last syllable", () => {
    expect(topic("여름")).toBe("여름은");
    expect(topic("바다")).toBe("바다는");
    expect(topic("포근이")).toBe("포근이는");
    expect(subject("지민")).toBe("지민이");
    expect(subject("포근이")).toBe("포근이가");
    expect(topic("아이")).toBe("아이는");
  });
  it("picks 을/를, also for a quoted word", () => {
    expect(object("산책")).toBe("산책을");
    expect(object("그림 그리기")).toBe("그림 그리기를");
    expect(`‘창밖 하늘 보기’${objectParticle("창밖 하늘 보기")}`).toBe("‘창밖 하늘 보기’를");
  });
  it("picks 와/과, (으)로, 이에요/예요 and the 이 of a called name", () => {
    expect(withAnd("지민")).toBe("지민과");
    expect(withAnd("수아")).toBe("수아와");
    expect(withRo("용기")).toBe("용기로");
    expect(withRo("기쁨")).toBe("기쁨으로");
    expect(withRo("교실")).toBe("교실로");
    expect(politeIs("불안")).toBe("불안이에요");
    expect(politeIs("하루")).toBe("하루예요");
    expect(callName("지민")).toBe("지민이");
    expect(callName("수아")).toBe("수아");
    expect(`“불안”${subjectParticle("불안")}`).toBe("“불안”이");
  });
  it("gives just the particle after a closing quote", () => {
    expect(`“피검사”${topicParticle("피검사")}`).toBe("“피검사”는");
    expect(`“재활 치료”${topicParticle("재활 치료")}`).toBe("“재활 치료”는");
    expect(`“MRI 검사”${objectParticle("MRI 검사")}`).toBe("“MRI 검사”를");
    expect(`“불안 · 외로움”${copulaParticle("외로움")}`).toBe("“불안 · 외로움”이에요");
    expect(`“기쁨 · 희망 · 평온”${copulaParticle("평온")}`).toBe("“기쁨 · 희망 · 평온”이에요");
    expect(copulaParticle("하루")).toBe("예요");
  });
});
