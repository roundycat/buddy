/**
 * Legal-guardian consent for children under 14 (개인정보 보호법 제22조의2)
 * and the separate sensitive-data consent (제23조).
 *
 * A child account with no consent state yet is treated as under 14 and waits
 * for a guardian's consent (only the local mock accounts skip this).
 */

/** Bump when the consent wording shown to guardians/children changes. */
export const CONSENT_VERSION = "2026-10-23";

export type ChildAgeBand = "under14" | "14plus";

export type ChildConsentStatus = "pending" | "granted";

export interface ChildSelfConsent {
  items: {
    privacyCollection: true;
    sensitiveData: true;
  };
  consentVersion: string;
  consentedAt: string;
}

/** One row per child — the gate every AI / data endpoint checks. */
export interface ChildConsentState {
  childUserId: string;
  /** Account name from signup — shown to guardians before a persona exists */
  childName?: string;
  ageBand: ChildAgeBand;
  status: ChildConsentStatus;
  /** Who gave the consent currently in force */
  basis?: "self" | "guardian";
  selfConsent?: ChildSelfConsent;
  createdAt: string;
  updatedAt: string;
}

export const GUARDIAN_RELATIONSHIPS = [
  "father",
  "mother",
  "grandparent",
  "other",
] as const;

export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

export const GUARDIAN_RELATIONSHIP_LABELS: Record<GuardianRelationship, string> =
  {
    father: "부",
    mother: "모",
    grandparent: "조부모",
    other: "기타 법정대리인",
  };

export interface GuardianConsentItems {
  /** 개인정보 수집·이용 */
  privacyCollection: boolean;
  /** 민감정보(마음·건강 관련 기록) 처리 — 제23조 별도 동의 */
  sensitiveData: boolean;
  /** AI 생성 기능 이용 */
  aiFeatures: boolean;
}

/** Proof of a legal guardian's consent. Kept after withdrawal (withdrawnAt). */
export interface GuardianConsentRecord {
  id: string;
  childUserId: string;
  guardianUserId: string;
  relationship: GuardianRelationship;
  guardianName: string;
  items: GuardianConsentItems;
  consentVersion: string;
  consentedAt: string;
  withdrawnAt?: string;
  /** The linked guardian who withdrew (any linked guardian can). */
  withdrawnBy?: string;
}

/** Shown instead of a guardian's name once that guardian deleted their account. */
export const DELETED_GUARDIAN_NAME = "탈퇴한 보호자";

/** Child-facing status. not_required = legacy account or no record. */
export interface ChildConsentView {
  required: boolean;
  status: "not_required" | ChildConsentStatus;
  ageBand: ChildAgeBand | null;
}

/** Guardian-facing status for the linked child. */
export interface GuardianConsentView {
  linked: boolean;
  childName: string | null;
  /** Child is under 14, so a legal guardian's consent is required */
  required: boolean;
  status: "not_required" | ChildConsentStatus;
  consentVersion: string;
  /**
   * Consent is in force and this linked guardian may withdraw it — whoever gave
   * it. Withdrawal ends every guardian's consent for the child.
   */
  canWithdraw: boolean;
  /** This guardian's own active consent, if any */
  mine: {
    relationship: GuardianRelationship;
    relationshipLabel: string;
    guardianName: string;
    consentedAt: string;
    consentVersion: string;
  } | null;
}

export function isGuardianRelationship(
  value: unknown
): value is GuardianRelationship {
  return (
    typeof value === "string" &&
    (GUARDIAN_RELATIONSHIPS as readonly string[]).includes(value)
  );
}
