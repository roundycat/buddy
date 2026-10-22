import { afterAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The guardian's Q&A reads these summary documents, so a child's own words —
 * a wish, a "기타" answer in the survey — must never be copied into them, and
 * the leak guard's reference must include everything the child wrote.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beddy-kb-privacy-"));
process.env.BEDDY_DATA_DIR = dir;
process.env.PERSISTENCE = "json";
process.env.LLM_PROVIDER = "mock";
process.env.BEDDY_METRICS = "0";
delete process.env.BEDROCK_KB_ID;

// Keep the mission agent out: a fixed pack for today with a child's note.
vi.mock("@/backend/features/adventure-quest/adventure-quest.service", () => ({
  getAdventureQuest: vi.fn(async () => ({
    headline: "창밖 하늘 모험",
    quests: [{ id: "q1", title: "창밖 하늘 보기", emoji: "☁️", status: "done" }],
  })),
}));

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const CHILD = "kb-child";

describe("profile chip labels", () => {
  it("separates the app's labels from what the child typed", async () => {
    const { presetChoices, freeTextChoices } = await import("@/shared/onboarding/profile-options");
    const stored = "🤫 말이 적어요, 🎬 드라마/영화, 밤에 몰래 우는 거";
    expect(presetChoices(stored)).toEqual(["말이 적어요", "드라마/영화"]);
    expect(freeTextChoices(stored)).toEqual(["밤에 몰래 우는 거"]);
  });
});

describe("summary documents for the guardian's Q&A", () => {
  it("carry wish kinds and chip labels, never a wish or a typed answer", async () => {
    const { saveWishTreeAccount } = await import("@/backend/features/wish-tree/wish-tree.store");
    await saveWishTreeAccount({
      userId: CHILD,
      wishes: [
        {
          id: "w1",
          text: "엄마 몰래 집에 가고 싶어",
          horizon: "anytime",
          emoji: "🏠",
          createdAt: new Date().toISOString(),
          kind: "home",
        },
      ],
    });
    const { getDefaultPersona, saveGeneratedPersona } = await import(
      "@/backend/features/persona/persona.store"
    );
    await saveGeneratedPersona(CHILD, {
      ...getDefaultPersona(),
      setupCompleted: true,
      self: {
        nickname: "하늘",
        ageOrBirthYear: "",
        region: "",
        disposition: "🤫 말이 적어요, 밤마다 혼자 울어요",
        mbti: "",
        strengthsWeaknesses: "",
        stressRelief: "",
        hobbies: "🎨 그림",
        favoriteHobby: "",
        mainActivity: "",
        favoriteFood: "",
      },
    });

    const { indexChildSummariesForKb } = await import("./index-summaries");
    await indexChildSummariesForKb(CHILD);
    const childDir = path.join(dir, "kb-summaries", CHILD);
    const interests = fs
      .readdirSync(childDir)
      .filter((f) => f.endsWith("-interests.md"))
      .map((f) => fs.readFileSync(path.join(childDir, f), "utf8"))
      .join("\n");
    expect(interests).toContain("소원 종류: 집 1개");
    expect(interests).not.toContain("엄마 몰래");
    expect(interests).not.toContain("혼자 울어요");

    const { recentChildWording } = await import("@/backend/ai/bridge/child-wording");
    const wording = await recentChildWording(CHILD);
    expect(wording).toContain("엄마 몰래 집에 가고 싶어");
    expect(wording).toContain("밤마다 혼자 울어요");
    expect(wording).not.toContain("🤫 말이 적어요");
  });
});
