import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/shared/persist/map-store", () =>
  import("@/test/stubs/memory-map-store")
);

vi.mock("@/backend/shared/config/env", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/backend/shared/config/env")>();
  return { ...actual, env: { ...actual.env, authProvider: "dynamodb" } };
});

const createDynamoUser = vi.fn();
vi.mock("./auth.users.dynamo.repo", () => ({
  findDynamoUserByEmail: vi.fn(async () => null),
  createDynamoUser: (input: unknown) => createDynamoUser(input),
  dynamoProfileToAuthUser: vi.fn(),
  verifyDynamoPassword: vi.fn(),
}));

import { resetMemoryMapStores } from "@/test/stubs/memory-map-store";
import { AuthError, signup } from "./auth.service";
import { getChildConsentState } from "@/backend/features/consent/consent.store";
import type { SignupRequest } from "./auth.types";

function request(patch: Partial<SignupRequest>): SignupRequest {
  return {
    email: "kid@bedi.app",
    password: "Abcdef12!",
    name: "지민",
    role: "child",
    ...patch,
  };
}

beforeEach(() => {
  resetMemoryMapStores();
  createDynamoUser.mockReset();
  createDynamoUser.mockImplementation(
    async (input: { id: string; email: string; name: string; role: string }) => ({
      id: input.id,
      email: input.email,
      name: input.name,
      role: input.role,
    })
  );
});

describe("signup → consent state", () => {
  it("under 14 creates the account with consent pending", async () => {
    const result = await signup(
      request({ childAgeBand: "under14", agreements: { ageOrGuardian: false, terms: true, privacy: false } })
    );
    const state = await getChildConsentState(result.user.id);
    expect(state).toMatchObject({
      ageBand: "under14",
      status: "pending",
      childName: "지민",
    });
  });

  it("14+ records separate privacy and sensitive-data consent", async () => {
    const result = await signup(
      request({
        childAgeBand: "14plus",
        agreements: { ageOrGuardian: false, terms: true, privacy: true, sensitive: true },
      })
    );
    const state = await getChildConsentState(result.user.id);
    expect(state).toMatchObject({ status: "granted", basis: "self" });
    expect(state?.selfConsent?.items).toEqual({
      privacyCollection: true,
      sensitiveData: true,
    });
  });

  it("14+ without the sensitive-data item is rejected before any write", async () => {
    await expect(
      signup(
        request({
          childAgeBand: "14plus",
          agreements: { ageOrGuardian: false, terms: true, privacy: true },
        })
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(createDynamoUser).not.toHaveBeenCalled();
  });

  it("a child must pick an age band", async () => {
    const error = await signup(
      request({ agreements: { ageOrGuardian: true, terms: true, privacy: true } })
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).status).toBe(400);
    expect(createDynamoUser).not.toHaveBeenCalled();
  });

  it("rolls the consent state back when the account cannot be created", async () => {
    createDynamoUser.mockRejectedValueOnce(new Error("DUPLICATE_EMAIL"));
    const error = await signup(
      request({ childAgeBand: "under14", agreements: { ageOrGuardian: false, terms: true, privacy: false } })
    ).catch((e: unknown) => e);
    expect((error as AuthError).status).toBe(409);
    const attemptedId = (createDynamoUser.mock.calls[0]![0] as { id: string }).id;
    expect(await getChildConsentState(attemptedId)).toBeNull();
  });

  it("guardians keep the 만 14세 이상 check and get no consent state", async () => {
    await expect(
      signup(
        request({
          role: "guardian",
          agreements: { ageOrGuardian: false, terms: true, privacy: true },
        })
      )
    ).rejects.toMatchObject({ status: 400 });

    const result = await signup(
      request({
        role: "guardian",
        agreements: { ageOrGuardian: true, terms: true, privacy: true },
      })
    );
    expect(await getChildConsentState(result.user.id)).toBeNull();
  });
});
