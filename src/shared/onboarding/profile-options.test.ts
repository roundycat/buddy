import { describe, expect, it } from "vitest";
import { choiceLabels, freeTextChoices, presetChoices } from "./profile-options";

describe("profile chip values", () => {
  it("still reads a chip label saved before it was reworded", () => {
    // "🏥 치료 받기" was the label until the spacing fix ("치료받기").
    expect(presetChoices("🏥 치료 받기, 🛌 휴식")).toEqual(["치료받기", "휴식"]);
    expect(freeTextChoices("🏥 치료 받기, 🛌 휴식")).toEqual([]);
  });
  it("drops emoji for the child's own screen and keeps typed text", () => {
    expect(choiceLabels("🤫 말이 적어요, 🤔 생각이 많아요")).toEqual(["말이 적어요", "생각이 많아요"]);
    expect(choiceLabels("📱 웹툰 보기, 종이접기")).toEqual(["웹툰 보기", "종이접기"]);
    expect(freeTextChoices("📱 웹툰 보기, 종이접기")).toEqual(["종이접기"]);
  });
});
