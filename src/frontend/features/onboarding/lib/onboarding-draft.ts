/**
 * Onboarding answers kept on this device only while an under-14 child waits
 * for legal-guardian consent. Nothing is sent to the server until consent
 * arrives; sessionStorage is per tab and keyed by account.
 */

import type { buildPersonaGeneratePayload } from "@/frontend/features/onboarding/lib/onboarding-payload";

export type PersonaGeneratePayload = ReturnType<
  typeof buildPersonaGeneratePayload
>;

export interface OnboardingDraft {
  payload: PersonaGeneratePayload;
  nickname: string;
}

function draftKey(accountId: string) {
  return `bedi-onboarding-draft-v1:${accountId}`;
}

export function readOnboardingDraft(accountId?: string): OnboardingDraft | null {
  if (!accountId) return null;
  try {
    const raw = window.sessionStorage.getItem(draftKey(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    if (!parsed?.payload || typeof parsed.nickname !== "string") return null;
    return parsed as OnboardingDraft;
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(
  accountId: string | undefined,
  draft: OnboardingDraft
) {
  if (!accountId) return;
  try {
    window.sessionStorage.setItem(draftKey(accountId), JSON.stringify(draft));
  } catch {
    /* storage unavailable — the panel still works for this visit */
  }
}

export function clearOnboardingDraft(accountId?: string) {
  if (!accountId) return;
  try {
    window.sessionStorage.removeItem(draftKey(accountId));
  } catch {
    /* ignore */
  }
}
