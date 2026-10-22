/**
 * Consent client API — child status polling, guardian consent / withdrawal.
 */

import type {
  ChildConsentView,
  GuardianConsentView,
  GuardianRelationship,
} from "@/backend/features/consent/consent.types";
import { fetchJson } from "@/frontend/shared/api/fetch-json";

export async function fetchChildConsent(): Promise<ChildConsentView> {
  return fetchJson<ChildConsentView>(
    "/api/consent",
    { cache: "no-store" },
    "동의 상태를 확인하지 못했어요."
  );
}

export async function submitGuardianConsent(input: {
  relationship: GuardianRelationship;
  guardianName: string;
  items: {
    privacyCollection: boolean;
    sensitiveData: boolean;
    aiFeatures: boolean;
  };
}): Promise<GuardianConsentView> {
  return fetchJson<GuardianConsentView>(
    "/api/guardian/consent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "동의를 저장하지 못했어요."
  );
}

export async function withdrawGuardianConsent(): Promise<GuardianConsentView> {
  return fetchJson<GuardianConsentView>(
    "/api/guardian/consent",
    { method: "DELETE" },
    "동의를 철회하지 못했어요."
  );
}
