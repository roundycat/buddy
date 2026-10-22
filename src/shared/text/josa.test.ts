import { describe, expect, it } from "vitest";
import { subject, topic } from "./josa";

describe("josa", () => {
  it("picks 은/는 and 이/가 by the last syllable", () => {
    expect(topic("여름")).toBe("여름은");
    expect(topic("바다")).toBe("바다는");
    expect(topic("포근이")).toBe("포근이는");
    expect(subject("지민")).toBe("지민이");
    expect(subject("포근이")).toBe("포근이가");
    expect(topic("아이")).toBe("아이는");
  });
});
