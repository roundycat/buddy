import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/shared/persist/map-store", () =>
  import("@/test/stubs/memory-map-store")
);

// Keep the mission agent out of these tests — a fixed pack for today.
vi.mock("@/backend/features/adventure-quest/adventure-quest.service", () => ({
  getAdventureQuest: vi.fn(async () => ({
    headline: "창밖 하늘 모험",
    quests: [
      { id: "q1", title: "창밖 하늘 보기", emoji: "☁️", status: "done" },
      { id: "q2", title: "좋아하는 노래 듣기", emoji: "🎵", status: "todo" },
    ],
    dayStory: { narrative: "오늘은 베디와 하늘을 봤어." },
  })),
}));

import { resetMemoryMapStores } from "@/test/stubs/memory-map-store";
import { todayKey } from "@/backend/shared/time/date";
import { saveLink } from "@/backend/features/guardian-link/guardian-link.store";
import { saveGardenAccount } from "@/backend/features/emotion-garden/emotion-garden.store";
import {
  appendConversationMessages,
  saveConversationMemory,
} from "@/backend/features/conversation/conversation.store";
import { createEmptyMemory } from "@/backend/features/conversation/memory.types";
import { createChildSafetyAlert } from "@/backend/features/safety/safety-alert.store";
import { savePreparedParentSummary } from "@/backend/features/parent/parent-daily-prep.store";
import { saveParentSettings, getParentSettings } from "@/backend/features/parent/parent-settings.store";
import {
  grantGuardianConsent,
  recordChildSignupConsent,
} from "@/backend/features/consent/consent.service";
import { updateChildShareChoices } from "@/backend/features/sharing/sharing.service";
import {
  answerConcernRequest,
  requestChildConsentForConcern,
} from "@/backend/features/sharing/concern-request.service";
import { guardianVisibilityKey } from "@/backend/features/sharing/share-policy";
import { askParentReport, getParentHome, getParentSafetyAlert } from "./parent.service";
import { requireGuardianMediaAccess } from "./parent-media.service";

const CHILD = "child-1";
const GUARDIAN = "guardian-1";

async function seedChildDay() {
  await saveLink({
    guardianUserId: GUARDIAN,
    childUserId: CHILD,
    linkedAt: new Date().toISOString(),
    inviteCode: "ABC123",
  });
  const day = todayKey();
  await saveGardenAccount({
    userId: CHILD,
    storybookSealed: false,
    flowers: [
      {
        id: `fl-${day}-happy`,
        mood: "happy",
        emoji: "🌻",
        dayIndex: 1,
        plantedOn: day,
        name: "해바라기",
        note: "",
        plantedAt: new Date().toISOString(),
        waterings: [],
      },
    ],
  });
  await saveConversationMemory({
    ...createEmptyMemory(CHILD),
    emotionalThemes: ["불안", "민지랑 싸움"],
    turnCount: 4,
  });
  await appendConversationMessages(CHILD, [
    {
      id: "u1",
      role: "user",
      content: "민지랑 703호 앞에서 크게 싸워서 너무 속상했어",
      createdAt: new Date().toISOString(),
    },
  ]);
}

beforeEach(() => {
  resetMemoryMapStores();
});

describe("guardian home — consent gate", () => {
  it("shows only the consent form for a pending under-14 child", async () => {
    await seedChildDay();
    await recordChildSignupConsent({
      childUserId: CHILD,
      childName: "지민",
      ageBand: "under14",
    });

    const home = await getParentHome(GUARDIAN);
    expect(home.linked).toBe(true);
    expect(home.consentGate).toMatchObject({ childName: "지민" });
    expect(home.child).toBeNull();
    expect(home.todayMessage).toBeNull();
    expect(home.emotion).toBeNull();
    expect(home.adventures).toEqual([]);
    expect(home.memories).toEqual([]);
    expect(home.media).toEqual([]);
    expect(home.empathyGuide).toBeNull();
    expect(home.sharing).toBeNull();
  });

  it("gates a child account that has no consent record the same way", async () => {
    await seedChildDay();
    const home = await getParentHome(GUARDIAN);
    expect(home.consentGate).not.toBeNull();
    expect(home.child).toBeNull();
    expect(home.todayMessage).toBeNull();
  });
});

describe("guardian home — child-controlled sharing", () => {
  beforeEach(async () => {
    await seedChildDay();
    await recordChildSignupConsent({ childUserId: CHILD, childName: "지민", ageBand: "under14" });
    await grantGuardianConsent(GUARDIAN, {
      relationship: "mother",
      guardianName: "김엄마",
      items: { privacyCollection: true, sensitiveData: true, aiFeatures: true },
    });
  });

  it("uses the defaults before the child has chosen (media private)", async () => {
    const home = await getParentHome(GUARDIAN);
    expect(home.consentGate).toBeNull();
    expect(home.sharing).toEqual({
      mood: "shown",
      adventures: "shown",
      memoryHighlights: "shown",
      media: "child_private",
    });
    expect(home.adventures).toHaveLength(2);
    expect(home.emotion).not.toBeNull();
    expect(home.media).toEqual([]);
  });

  it("returns flags without content or counts for private categories", async () => {
    await updateChildShareChoices(CHILD, {
      mood: "private",
      adventures: "private",
    });
    const home = await getParentHome(GUARDIAN);

    expect(home.sharing?.mood).toBe("child_private");
    expect(home.sharing?.adventures).toBe("child_private");
    expect(home.emotion).toBeNull();
    expect(home.adventures).toEqual([]);
    expect(home.child?.moodLabel).toBe("");

    const text = JSON.stringify(home);
    expect(text).not.toContain("해바라기");
    expect(text).not.toContain("창밖 하늘");
    expect(text).not.toContain("1가지");
    expect(text).not.toContain("2개 중");
    expect(home.memories.map((m) => m.id)).not.toContain("mood");
    expect(home.memories.some((m) => m.kind === "mission")).toBe(false);
  });

  it("needs the guardian's own toggle too", async () => {
    const settings = await getParentSettings(GUARDIAN);
    await saveParentSettings({
      ...settings,
      privacy: { ...settings.privacy, shareAdventures: false },
    });
    const home = await getParentHome(GUARDIAN);
    expect(home.sharing?.adventures).toBe("guardian_off");
    expect(home.adventures).toEqual([]);
  });

  it("serves media only after the child shares it", async () => {
    await expect(requireGuardianMediaAccess(GUARDIAN)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await updateChildShareChoices(CHILD, { media: "share" });
    await expect(requireGuardianMediaAccess(GUARDIAN)).resolves.toBe(CHILD);
    expect((await getParentHome(GUARDIAN)).sharing?.media).toBe("shown");
  });

  it("drops themes that echo chat and guards prepared text", async () => {
    const home = await getParentHome(GUARDIAN);
    expect(JSON.stringify(home)).not.toContain("민지");

    await savePreparedParentSummary({
      guardianUserId: GUARDIAN,
      childUserId: CHILD,
      dateKey: todayKey(),
      empathyGuide: null,
      todayMessage: "민지랑 703호 앞에서 크게 싸워서 너무 속상했대요.",
      visibilityKey: guardianVisibilityKey(home.sharing!),
      preparedAt: new Date().toISOString(),
    });
    const again = await getParentHome(GUARDIAN);
    expect(again.todayMessage?.text).not.toContain("민지");
    expect(again.todayMessage?.text).not.toContain("703호");
  });

  it("ignores prepared text built with older sharing choices", async () => {
    await savePreparedParentSummary({
      guardianUserId: GUARDIAN,
      childUserId: CHILD,
      dateKey: todayKey(),
      empathyGuide: null,
      todayMessage: "오래된 요약이에요. 작은 모험을 했어요.",
      visibilityKey: "stale",
      preparedAt: new Date().toISOString(),
    });
    const home = await getParentHome(GUARDIAN);
    expect(home.todayMessage?.text).not.toBe("오래된 요약이에요. 작은 모험을 했어요.");
  });

  it("shows approved concern notices (summary only)", async () => {
    const request = await requestChildConsentForConcern(
      CHILD,
      "요즘 마음이 힘들어 보여요."
    );
    expect((await getParentHome(GUARDIAN)).concernNotices).toEqual([]);
    await answerConcernRequest(CHILD, request!.id, true);
    const home = await getParentHome(GUARDIAN);
    expect(home.concernNotices).toHaveLength(1);
    expect(home.concernNotices[0]!.summary).toBe("요즘 마음이 힘들어 보여요.");
  });

  it("answers guardians from the summary when the AI is offline (no key or daily cap)", async () => {
    // The offline persona talks to the child ("…, 불안한 거 느껴져"); it must not reach a guardian.
    const report = await askParentReport(GUARDIAN, "요즘 기분 흐름은 어때요?");
    expect(report.answer?.answer).toContain("최근 기분 흐름은");
    expect(report.answer?.answer).not.toMatch(/느껴져|나는 여기 있을게|숨 하나만/);
    const home = await getParentHome(GUARDIAN);
    expect(home.todayMessage?.text ?? "").not.toMatch(/느껴져|나는 여기 있을게|숨 하나만/);
  });

  it("keeps safety alerts to the fact that help is needed", async () => {
    await createChildSafetyAlert({
      childUserId: CHILD,
      level: "urgent",
      summary: "민지랑 703호 앞에서 크게 싸워서 너무 속상했어",
    });
    const alert = await getParentSafetyAlert(GUARDIAN);
    expect(alert?.level).toBe("urgent");
    expect(alert?.summary).not.toContain("민지");
    expect((await getParentHome(GUARDIAN)).safetyAlert?.summary).toBe(
      alert?.summary
    );
  });
});
