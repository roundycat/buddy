import "server-only";
import { DomainError } from "@/backend/shared/http/domain-error";
import { getStoredSharingPrefs, saveSharingPrefs } from "./sharing.store";
import {
  SHARE_CATEGORIES,
  isShareCategory,
  isShareChoice,
  withDefaultShareChoices,
  type ShareCategory,
  type ShareChoice,
  type ShareChoices,
} from "./sharing.types";

export interface ChildSharingView {
  choices: ShareChoices;
  updatedAt: string | null;
}

/** The child's choices with defaults filled in. */
export async function getChildShareChoices(
  childUserId: string
): Promise<ShareChoices> {
  const stored = await getStoredSharingPrefs(childUserId);
  return withDefaultShareChoices(stored?.choices);
}

export async function getChildSharingView(
  childUserId: string
): Promise<ChildSharingView> {
  const stored = await getStoredSharingPrefs(childUserId);
  return {
    choices: withDefaultShareChoices(stored?.choices),
    updatedAt: stored?.updatedAt ?? null,
  };
}

export async function updateChildShareChoices(
  childUserId: string,
  patch: Record<string, unknown> | null | undefined
): Promise<ChildSharingView> {
  const updates: Partial<Record<ShareCategory, ShareChoice>> = {};
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (!isShareCategory(key) || !isShareChoice(value)) {
      throw new DomainError("나눌 항목과 선택을 다시 확인해 주세요.");
    }
    updates[key] = value;
  }
  if (Object.keys(updates).length === 0) {
    throw new DomainError("바꿀 항목을 골라 주세요.");
  }

  const current = await getChildShareChoices(childUserId);
  const choices = { ...current };
  for (const category of SHARE_CATEGORIES) {
    const value = updates[category];
    if (value) choices[category] = value;
  }

  const saved = await saveSharingPrefs({
    childUserId,
    choices,
    updatedAt: new Date().toISOString(),
  });
  return { choices: withDefaultShareChoices(saved.choices), updatedAt: saved.updatedAt };
}
