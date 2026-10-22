import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The welcome bubble is the friend talking to the child: 반말, no design
 * notes, and the 해요체 chip labels quoted rather than pasted into a sentence.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beddy-persona-welcome-"));
process.env.BEDDY_DATA_DIR = dir;
process.env.PERSISTENCE = "json";

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const survey = {
  nickname: "",
  ageOrBirthYear: "",
  region: "",
  disposition: "🤫 말이 적어요, 🤔 생각이 많아요",
  mbti: "",
  strengthsWeaknesses: "",
  stressRelief: "",
  hobbies: "",
  favoriteHobby: "📱 웹툰 보기, 🎧 음악 듣기",
  mainActivity: "🏥 치료받기",
  favoriteFood: "",
};

describe("Beddy's welcome bubble", () => {
  it("speaks to the child in 반말 and quotes the chip labels", async () => {
    const { buildPersonaFromPreferences } = await import("./persona.store");
    const persona = buildPersonaFromPreferences("u-welcome", {
      mode: "mirror",
      self: { ...survey, nickname: "지민" },
      character: { ...survey, nickname: "포근이" },
      energy: "medium",
      interaction: "listen",
    });
    const text = persona.companionMessage;

    expect(text).toContain("나는 먼저 네 이야기를 들을게.");
    expect(text).toContain("성격은 ‘말이 적어요’, ‘생각이 많아요’에 가까워.");
    expect(text).toContain("평소엔 ‘웹툰 보기’, ‘음악 듣기’ 이야기도 좋아해.");
    // No design notes ("…비춤.", "…쪽.") and no chip emoji in the bubble
    expect(text).not.toMatch(/비춤|머무름|쪽\./);
    expect(text).not.toMatch(/🤫|🤔|📱|🎧/);
  });

  it("rebuilds the bubble for a friend saved with older wording", async () => {
    const { buildPersonaFromPreferences, getPersonaForUser, saveGeneratedPersona } =
      await import("./persona.store");
    const persona = buildPersonaFromPreferences("u-old", {
      mode: "custom",
      self: { ...survey, nickname: "하늘" },
      character: { ...survey, nickname: "구름" },
      energy: "low",
      interaction: "quiet",
    });
    await saveGeneratedPersona("u-old", {
      ...persona,
      companionMessage: "말투는 조용한 동반형 Beddy 쪽. 말이 적어도 괜찮음.",
    });

    const read = await getPersonaForUser("u-old");
    expect(read.companionMessage).toContain("말이 적어도 괜찮아. 조용히 옆에 있을게.");
    expect(read.companionMessage).not.toContain("쪽.");
  });
});
