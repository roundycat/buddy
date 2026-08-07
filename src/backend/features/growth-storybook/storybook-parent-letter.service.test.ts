import { describe, expect, it } from "vitest";
import {
  isParentLetterUnlocked,
  toChildParentLetter,
} from "./storybook-parent-letter.service";
import type { StoredStorybookParentLetter } from "./storybook-parent-letter.store";

function letter(
  patch: Partial<StoredStorybookParentLetter> = {}
): StoredStorybookParentLetter {
  return {
    childUserId: "child-1",
    guardianUserId: "g-1",
    title: "",
    body: "사랑해",
    bodyHtml: "<p>사랑해</p>",
    signature: "엄마",
    date: "2026-08-01",
    dischargeDate: "2026-08-10",
    sentAt: "2026-08-01T01:00:00.000Z",
    handwriting: true,
    hasPhoto: true,
    photoUrl: "/api/storybook/parent-letter/photo",
    updatedAt: "2026-08-01T01:00:00.000Z",
    ...patch,
  };
}

describe("isParentLetterUnlocked", () => {
  it("unlocks on the discharge day itself", () => {
    expect(
      isParentLetterUnlocked("2026-08-10", new Date("2026-08-10T09:00:00"))
    ).toBe(true);
  });

  it("stays locked before the discharge day", () => {
    expect(
      isParentLetterUnlocked("2026-08-10", new Date("2026-08-09T23:00:00"))
    ).toBe(false);
  });

  it("treats legacy letters without a date as unlocked", () => {
    expect(isParentLetterUnlocked(undefined)).toBe(true);
  });
});

describe("toChildParentLetter", () => {
  it("redacts body and photo while locked", () => {
    const view = toChildParentLetter(letter());
    // Force locked by comparing against an early "today" via dischargeDate far future
    const locked = toChildParentLetter(
      letter({ dischargeDate: "2099-01-01" })
    );
    expect(locked?.locked).toBe(true);
    expect(locked?.body).toBe("");
    expect(locked?.photoUrl).toBeUndefined();
    expect(locked?.signature).toBe("엄마");
    expect(view?.sentAt).toBeTruthy();
  });

  it("reveals content once unlocked", () => {
    const view = toChildParentLetter(
      letter({ dischargeDate: "2020-01-01" })
    );
    expect(view?.locked).toBe(false);
    expect(view?.body).toBe("사랑해");
    expect(view?.photoUrl).toContain("parent-letter/photo");
  });

  it("returns null when nothing was sent", () => {
    expect(
      toChildParentLetter(
        letter({ sentAt: undefined, body: "", updatedAt: "" })
      )
    ).toBeNull();
  });
});
