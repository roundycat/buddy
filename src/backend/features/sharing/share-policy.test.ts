import { describe, expect, it } from "vitest";
import {
  decideShare,
  resolveCategoryVisibility,
  resolveGuardianVisibility,
} from "./share-policy";
import { DEFAULT_SHARE_CHOICES } from "./sharing.types";

describe("decideShare — crisis rules come first", () => {
  it.each(["urgent", "elevated"] as const)(
    "%s → minimal, even when the child said private",
    (crisisLevel) => {
      expect(
        decideShare({ kind: "mood", crisisLevel, childChoice: "private" })
      ).toEqual({ decision: "minimal", reason: "crisis_minimal" });
    }
  );

  it("urgent outranks care actions and persistent distress", () => {
    expect(
      decideShare({
        kind: "safety",
        crisisLevel: "urgent",
        careAction: true,
        persistentDistress: true,
        childChoice: "share",
      }).decision
    ).toBe("minimal");
  });

  it("protect → protect_route, never an automatic guardian notice", () => {
    expect(
      decideShare({
        kind: "safety",
        crisisLevel: "protect",
        careAction: true,
        childChoice: "share",
      })
    ).toEqual({ decision: "protect_route", reason: "crisis_protect" });
  });

  it("protect outranks persistent distress", () => {
    expect(
      decideShare({
        kind: "concern",
        crisisLevel: "protect",
        persistentDistress: true,
      }).decision
    ).toBe("protect_route");
  });
});

describe("decideShare — non-crisis rules", () => {
  it("persistent distress → ask_child before anything is shared", () => {
    expect(
      decideShare({
        kind: "concern",
        persistentDistress: true,
        childChoice: "share",
        careAction: true,
      })
    ).toEqual({ decision: "ask_child", reason: "persistent_distress" });
  });

  it.each(["none", "watch"] as const)(
    "crisisLevel %s falls through to the next rules",
    (crisisLevel) => {
      expect(
        decideShare({ kind: "concern", crisisLevel, persistentDistress: true })
          .decision
      ).toBe("ask_child");
      expect(
        decideShare({ kind: "media", crisisLevel }).decision
      ).toBe("private");
    }
  );

  it("care action → share of that request, even if the category is private", () => {
    expect(
      decideShare({ kind: "schedule", careAction: true, childChoice: "private" })
    ).toEqual({ decision: "share", reason: "care_action" });
    expect(
      decideShare({ kind: "help_request", careAction: true }).decision
    ).toBe("share");
  });

  it.each(["share", "private"] as const)(
    "follows the child's choice (%s)",
    (childChoice) => {
      expect(decideShare({ kind: "media", childChoice })).toEqual({
        decision: childChoice,
        reason: "child_choice",
      });
      expect(decideShare({ kind: "mood", childChoice }).decision).toBe(
        childChoice
      );
    }
  );

  it.each([
    ["mood", "share"],
    ["adventures", "share"],
    ["memoryHighlights", "share"],
    ["media", "private"],
  ] as const)("default for %s is %s", (kind, expected) => {
    expect(decideShare({ kind })).toEqual({
      decision: expected,
      reason: "category_default",
    });
  });

  it("kinds without a default stay private when nothing applies", () => {
    expect(decideShare({ kind: "concern" })).toEqual({
      decision: "private",
      reason: "no_basis",
    });
    expect(decideShare({ kind: "safety", crisisLevel: "none" }).decision).toBe(
      "private"
    );
  });
});

describe("guardian visibility — child share AND guardian toggle", () => {
  it("shows only when both agree", () => {
    expect(resolveCategoryVisibility("mood", "share", true)).toBe("shown");
    expect(resolveCategoryVisibility("mood", "share", false)).toBe(
      "guardian_off"
    );
    expect(resolveCategoryVisibility("mood", "private", true)).toBe(
      "child_private"
    );
    expect(resolveCategoryVisibility("mood", "private", false)).toBe(
      "child_private"
    );
  });

  it("uses category defaults when the child has not chosen", () => {
    expect(resolveCategoryVisibility("media", undefined, true)).toBe(
      "child_private"
    );
    expect(resolveCategoryVisibility("adventures", undefined, true)).toBe(
      "shown"
    );
  });

  it("maps every category", () => {
    const map = resolveGuardianVisibility(
      { ...DEFAULT_SHARE_CHOICES, adventures: "private" },
      { mood: true, adventures: true, memoryHighlights: false, media: true }
    );
    expect(map).toEqual({
      mood: "shown",
      adventures: "child_private",
      memoryHighlights: "guardian_off",
      media: "child_private",
    });
  });
});
