import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * "AI로 그렸어요" is shown only on portraits an image model drew. Without an
 * image model the friend is one of the bundled crayon drawings, which keeps
 * no AI label.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beddy-avatar-label-"));
process.env.BEDDY_DATA_DIR = dir;
process.env.AVATAR_LOCAL_DIR = path.join(dir, "avatars");
process.env.PERSISTENCE = "json";
process.env.IMAGE_PROVIDER = "bundled";
process.env.LLM_PROVIDER = "mock";
process.env.BEDDY_METRICS = "0";

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const survey = {
  nickname: "",
  ageOrBirthYear: "",
  region: "",
  disposition: "",
  mbti: "",
  strengthsWeaknesses: "",
  stressRelief: "",
  hobbies: "",
  favoriteHobby: "",
  mainActivity: "",
  favoriteFood: "",
};

describe("the AI label on the friend's portrait", () => {
  it("is off for the bundled drawings, both drawn and picked", async () => {
    const store = await import("./persona.store");
    const service = await import("./persona.service");
    const persona = store.buildPersonaFromPreferences("u-bundled", {
      mode: "mirror",
      self: { ...survey, nickname: "지민" },
      character: { ...survey, nickname: "포근이" },
      energy: "medium",
      interaction: "listen",
    });
    await store.saveGeneratedPersona("u-bundled", persona);

    const { avatarChoices } = await service.regeneratePersonaAvatars("u-bundled");
    expect(avatarChoices.length).toBeGreaterThan(0);
    expect((await store.getPersonaForUser("u-bundled")).avatarAiMade).toBe(false);

    const picked = await service.choosePersonaAvatar("u-bundled", avatarChoices[0]!.id);
    expect(picked.avatarAiMade).toBe(false);
    expect((await store.getPersonaForUser("u-bundled")).avatarAiMade).toBe(false);
  });
});
