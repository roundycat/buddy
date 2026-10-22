import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/shared/persist/map-store", () =>
  import("@/test/stubs/memory-map-store")
);

import { resetMemoryMapStores } from "@/test/stubs/memory-map-store";
import { DomainError } from "@/backend/shared/http/domain-error";
import {
  clearLinkForGuardian,
  saveLink,
} from "@/backend/features/guardian-link/guardian-link.store";
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
import {
  anonymizeGuardianConsentRecords,
  getChildConsentState,
  listGuardianConsentsForChild,
} from "./consent.store";
import { CONSENT_VERSION, DELETED_GUARDIAN_NAME } from "./consent.types";

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
  it("a child account without any consent record must get guardian consent first", async () => {
    expect(await getChildConsentView("legacy-child")).toEqual({
      required: true,
      status: "pending",
      ageBand: "under14",
    });
    expect(await isChildConsentPending("legacy-child")).toBe(true);
    await expect(assertChildConsented("legacy-child")).rejects.toBeInstanceOf(ConsentRequiredError);
    // Guardians never need it.
    expect(await isChildConsentPending({ id: "legacy-guardian", role: "guardian" })).toBe(false);
    await expect(assertChildConsented({ id: "legacy-guardian", role: "guardian" })).resolves.toBeUndefined();
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
    expect(await getChildConsentState(CHILD)).toBeNull();
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
    await recordChildSignupConsent({
      childUserId: "teen-child",
      ageBand: "14plus",
      selfItems: { privacyCollection: true, sensitiveData: true },
    });
    await link(MOM, "teen-child");
    expect((await getGuardianConsentView(MOM)).required).toBe(false);
    await expectDomainError(grantGuardianConsent(MOM, validConsent), "CONFLICT");
  });

  it("a linked guardian can consent for a child that has no consent record", async () => {
    await link(MOM, "legacy-child");
    expect(await getGuardianConsentView(MOM)).toMatchObject({ required: true, status: "pending" });
    await grantGuardianConsent(MOM, validConsent);
    expect(await getChildConsentState("legacy-child")).toMatchObject({
      ageBand: "under14",
      status: "granted",
      basis: "guardian",
    });
    expect(await isChildConsentPending("legacy-child")).toBe(false);
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

  it("one guardian's withdrawal ends every guardian's consent", async () => {
    await link(MOM);
    await link(DAD);
    await grantGuardianConsent(MOM, validConsent);
    await grantGuardianConsent(DAD, {
      ...validConsent,
      relationship: "father",
      guardianName: "김아빠",
    });

    const view = await withdrawGuardianConsent(MOM);
    expect(view.status).toBe("pending");
    expect(await isChildConsentPending(CHILD)).toBe(true);
    const records = await listGuardianConsentsForChild(CHILD);
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.withdrawnAt && r.withdrawnBy === MOM)).toBe(true);
  });

  it("a linked guardian who did not give the consent can still withdraw it", async () => {
    await link(MOM);
    await grantGuardianConsent(MOM, validConsent);
    await link(DAD);
    expect(await getGuardianConsentView(DAD)).toMatchObject({ canWithdraw: true, mine: null });
    await withdrawGuardianConsent(DAD);
    expect(await isChildConsentPending(CHILD)).toBe(true);
  });

  it("a consent left by a guardian who unlinked cannot outlive a withdrawal", async () => {
    await link(MOM);
    await grantGuardianConsent(MOM, validConsent);
    await clearLinkForGuardian(MOM);
    await link(DAD);
    await withdrawGuardianConsent(DAD);
    expect(await isChildConsentPending(CHILD)).toBe(true);
    expect((await listGuardianConsentsForChild(CHILD)).every((r) => r.withdrawnAt)).toBe(true);
  });

  it("a guardian who deletes their account leaves the proof without their name", async () => {
    await link(MOM);
    await grantGuardianConsent(MOM, validConsent);
    await anonymizeGuardianConsentRecords(MOM);
    const [record] = await listGuardianConsentsForChild(CHILD);
    expect(record).toMatchObject({ guardianName: DELETED_GUARDIAN_NAME, relationship: "mother" });
  });

  it("cannot withdraw a consent that was never given", async () => {
    await link(MOM);
    await expectDomainError(withdrawGuardianConsent(MOM), "NOT_FOUND");
  });
});
