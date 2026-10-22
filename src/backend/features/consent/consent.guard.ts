import "server-only";
import { DomainError } from "@/backend/shared/http/domain-error";
import { getLinkForGuardian } from "@/backend/features/guardian-link/guardian-link.store";
import { env } from "@/backend/shared/config/env";
import { getChildConsentState } from "./consent.store";

/**
 * Consent gate for AI and data-collecting endpoints.
 * A child account with no consent record (made before consent existed, or a
 * signup that broke half-way) is treated like a pending one: consent first.
 * Guardians never need it. Only the local mock provider keeps old accounts open.
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

/** A user id (read as a child's) or the session user, whose role decides. */
export type ConsentGateUser = string | { id: string; role?: string | null };

/** True while this account may not use AI or data features yet. */
export async function isChildConsentPending(
  user: ConsentGateUser | null | undefined
): Promise<boolean> {
  if (!user) return false;
  const id = typeof user === "string" ? user : user.id;
  const role = typeof user === "string" ? "child" : user.role;
  if (!id || role === "guardian") return false;
  const state = await getChildConsentState(id);
  if (state) return state.status === "pending";
  return env.authProvider !== "mock";
}

/**
 * Throw ConsentRequiredError when the child still needs guardian consent.
 * Pass the session user so guardians pass; a bare id is read as a child's.
 */
export async function assertChildConsented(user: ConsentGateUser): Promise<void> {
  if (await isChildConsentPending(user)) {
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
