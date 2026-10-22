import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/shared/persist/map-store", () =>
  import("@/test/stubs/memory-map-store")
);

import { resetMemoryMapStores } from "@/test/stubs/memory-map-store";
import { DomainError } from "@/backend/shared/http/domain-error";
import { saveLink } from "@/backend/features/guardian-link/guardian-link.store";
import {
  discardChildSignupConsent,
  getChildConsentView,
  getGuardianConsentView,
  grantGuardianConsent,
  recordChildSignupConsent,
  withdrawGuardianConsent,
} from "./consent.service";
import {
  ConsentRequiredError,
  assertChildConsented,
  isChildConsentPending,
} from "./consent.guard";
import { listGuardianConsentsForChild } from "./consent.store";
import { CONSENT_VERSION } from "./consent.types";

const CHILD = "child-under14";
const MOM = "guardian-mom";
const DAD = "guardian-dad";

const validConsent = {
  relationship: "mother",
  guardianName: "김엄마",
  items: { privacyCollection: true, sensitiveData: true, aiFeatures: true },
};

async function link(guardianUserId: string, childUserId = CHILD) {
  await saveLink({
    guardianUserId,
    childUserId,
    linkedAt: new Date().toISOString(),
    inviteCode: "ABC123",
  });
}

async function expectDomainError(
  promise: Promise<unknown>,
  code: DomainError["code"]
) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
}

beforeEach(() => {
  resetMemoryMapStores();
});

describe("child consent gate", () => {
  it("legacy children without any consent state keep working", async () => {
    expect(await getChildConsentView("legacy-child")).toEqual({
      required: false,
      status: "not_required",
      ageBand: null,
    });
    expect(await isChildConsentPending("legacy-child")).toBe(false);
    await expect(assertChildConsented("legacy-child")).resolves.toBeUndefined();
  });

  it("under-14 signup starts pending and is blocked with a 403-mapped error", async () => {
    await recordChildSignupConsent({
      childUserId: CHILD,
      childName: "지민",
      ageBand: "under14",
    });
    expect(await getChildConsentView(CHILD)).toEqual({
      required: true,
      status: "pending",
      ageBand: "under14",
    });

    const error = await assertChildConsented(CHILD).then(
      () => null,
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(ConsentRequiredError);
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("FORBIDDEN");
    expect((error as Error).message).toContain("보호자");
  });

  it("14+ signup records the child's own, separate sensitive-data consent", async () => {
    const state = await recordChildSignupConsent({
      childUserId: "teen",
      ageBand: "14plus",
      selfItems: { privacyCollection: true, sensitiveData: true },
    });
    expect(state.status).toBe("granted");
    expect(state.basis).toBe("self");
    expect(state.selfConsent?.consentVersion).toBe(CONSENT_VERSION);
    await expect(assertChildConsented("teen")).resolves.toBeUndefined();
    expect((await getChildConsentView("teen")).required).toBe(false);
  });

  it("14+ signup without the sensitive-data item is rejected", async () => {
    await expectDomainError(
      recordChildSignupConsent({
        childUserId: "teen",
        ageBand: "14plus",
        selfItems: { privacyCollection: true, sensitiveData: false },
      }),
      "VALIDATION"
    );
  });

  it("signup rollback returns the id to a clean slate", async () => {
    await recordChildSignupConsent({ childUserId: CHILD, ageBand: "under14" });
    await discardChildSignupConsent(CHILD);
    expect((await getChildConsentView(CHILD)).status).toBe("not_required");
  });
});

describe("guardian consent", () => {
  beforeEach(async () => {
    await recordChildSignupConsent({
      childUserId: CHILD,
      childName: "지민",
      ageBand: "under14",
    });
  });

  it("requires a link first", async () => {
    await expectDomainError(grantGuardianConsent(MOM, validConsent), "FORBIDDEN");
  });

  it("shows the pending child to a newly linked guardian", async () => {
    await link(MOM);
    expect(await getGuardianConsentView(MOM)).toMatchObject({
      linked: true,
      childName: "지민",
      required: true,
      status: "pending",
      mine: null,
    });
  });

  it("refuses consent for children who do not need it", async () => {
    await link(MOM, "legacy-child");
    expect((await getGuardianConsentView(MOM)).required).toBe(false);
    await expectDomainError(grantGuardianConsent(MOM, validConsent), "CONFLICT");
  });

  it.each([
    [{ ...validConsent, relationship: "uncle" }],
    [{ ...validConsent, guardianName: "  " }],
    [{ ...validConsent, guardianName: "가".repeat(21) }],
    [{ ...validConsent, items: { ...validConsent.items, aiFeatures: false } }],
    [{ ...validConsent, items: { privacyCollection: true, sensitiveData: true } }],
  ])("validates the form (%#)", async (input) => {
    await link(MOM);
    await expectDomainError(grantGuardianConsent(MOM, input), "VALIDATION");
    expect(await isChildConsentPending(CHILD)).toBe(true);
  });

  it("granting stores the record and flips the child to granted", async () => {
    await link(MOM);
    const view = await grantGuardianConsent(MOM, validConsent);
    expect(view).toMatchObject({
      status: "granted",
      required: true,
      mine: {
        relationship: "mother",
        relationshipLabel: "모",
        guardianName: "김엄마",
        consentVersion: CONSENT_VERSION,
      },
    });
    await expect(assertChildConsented(CHILD)).resolves.toBeUndefined();

    const [record] = await listGuardianConsentsForChild(CHILD);
    expect(record).toMatchObject({
      childUserId: CHILD,
      guardianUserId: MOM,
      relationship: "mother",
      guardianName: "김엄마",
      items: { privacyCollection: true, sensitiveData: true, aiFeatures: true },
      consentVersion: CONSENT_VERSION,
    });
    expect(record?.consentedAt).toBeTruthy();
    expect(record?.withdrawnAt).toBeUndefined();

    // Submitting twice does not create a second proof
    await grantGuardianConsent(MOM, validConsent);
    expect(await listGuardianConsentsForChild(CHILD)).toHaveLength(1);
  });

  it("withdrawal keeps the proof, flips the child back to pending", async () => {
    await link(MOM);
    await grantGuardianConsent(MOM, validConsent);

    const view = await withdrawGuardianConsent(MOM);
    expect(view.status).toBe("pending");
    expect(view.mine).toBeNull();
    expect(await isChildConsentPending(CHILD)).toBe(true);

    const [record] = await listGuardianConsentsForChild(CHILD);
    expect(record?.withdrawnAt).toBeTruthy();

    // Can consent again after withdrawing
    await grantGuardianConsent(MOM, validConsent);
    expect(await isChildConsentPending(CHILD)).toBe(false);
    expect(await listGuardianConsentsForChild(CHILD)).toHaveLength(2);
  });

  it("another guardian's active consent keeps the child granted", async () => {
    await link(MOM);
    await link(DAD);
    await grantGuardianConsent(MOM, validConsent);
    await grantGuardianConsent(DAD, {
      ...validConsent,
      relationship: "father",
      guardianName: "김아빠",
    });

    const view = await withdrawGuardianConsent(MOM);
    expect(view.status).toBe("granted");
    expect(await isChildConsentPending(CHILD)).toBe(false);
  });

  it("cannot withdraw a consent that was never given", async () => {
    await link(MOM);
    await expectDomainError(withdrawGuardianConsent(MOM), "NOT_FOUND");
  });
});
