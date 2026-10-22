import { describe, expect, it } from "vitest";
import { object, objectParticle, subject, topic } from "./josa";

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
});
