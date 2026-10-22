import "server-only";
import { DomainError } from "@/backend/shared/http/domain-error";
import { getLinkForGuardian } from "@/backend/features/guardian-link/guardian-link.store";
import { getChildConsentState } from "./consent.store";

/**
 * Consent gate for AI and data-collecting endpoints.
 * Legacy children (no consent state) are never blocked.
 */

export const GUARDIAN_CONSENT_REQUIRED_MESSAGE =
  "보호자(법정대리인) 동의가 필요해요. 보호자가 동의하면 바로 이어서 할 수 있어요.";

const GUARDIAN_SIDE_MESSAGE =
  "먼저 보호자(법정대리인) 동의를 완료해 주세요. 홈 화면에서 바로 할 수 있어요.";

/** DomainError (FORBIDDEN → 403 via withApiGuard) with a stable code. */
export class ConsentRequiredError extends DomainError {
  readonly consentCode = "GUARDIAN_CONSENT_REQUIRED" as const;

  constructor(message = GUARDIAN_CONSENT_REQUIRED_MESSAGE) {
    super(message, "FORBIDDEN");
    this.name = "ConsentRequiredError";
  }
}

export function isConsentRequiredError(
  error: unknown
): error is ConsentRequiredError {
  return error instanceof ConsentRequiredError;
}

/** True only for under-14 children still waiting for guardian consent. */
export async function isChildConsentPending(
  childUserId: string | null | undefined
): Promise<boolean> {
  if (!childUserId) return false;
  const state = await getChildConsentState(childUserId);
  return state?.status === "pending";
}

/**
 * Throw ConsentRequiredError when the child still needs guardian consent.
 * Safe to call with any user id: guardians and legacy children pass.
 */
export async function assertChildConsented(userId: string): Promise<void> {
  if (await isChildConsentPending(userId)) {
    throw new ConsentRequiredError();
  }
}

/** Guardian-side variant: AI work on the linked child's data needs consent first. */
export async function assertLinkedChildConsented(
  guardianUserId: string
): Promise<void> {
  const link = await getLinkForGuardian(guardianUserId);
  if (link && (await isChildConsentPending(link.childUserId))) {
    throw new ConsentRequiredError(GUARDIAN_SIDE_MESSAGE);
  }
}
