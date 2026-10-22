import "server-only";
import { DomainError } from "@/backend/shared/http/domain-error";
import { getLinkForGuardian } from "@/backend/features/guardian-link/guardian-link.store";
import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import {
  getChildConsentState,
  deleteChildConsentState,
  listGuardianConsentsForChild,
  saveChildConsentState,
  saveGuardianConsentRecord,
} from "./consent.store";
import {
  CONSENT_VERSION,
  GUARDIAN_RELATIONSHIP_LABELS,
  isGuardianRelationship,
  type ChildAgeBand,
  type ChildConsentState,
  type ChildConsentView,
  type GuardianConsentItems,
  type GuardianConsentRecord,
  type GuardianConsentView,
} from "./consent.types";
import { eraseChildCollectedData } from "@/backend/features/privacy/child-data-erase";

const GUARDIAN_NAME_MAX = 20;

function nowIso() {
  return new Date().toISOString();
}

function isActive(record: GuardianConsentRecord) {
  return !record.withdrawnAt;
}

/**
 * Signup: under 14 → pending until a legal guardian consents;
 * 14+ → the child's own consent, with sensitive data consented separately.
 */
export async function recordChildSignupConsent(input: {
  childUserId: string;
  childName?: string;
  ageBand: ChildAgeBand;
  selfItems?: { privacyCollection: boolean; sensitiveData: boolean };
}): Promise<ChildConsentState> {
  const at = nowIso();
  const base = {
    childUserId: input.childUserId,
    childName: input.childName?.trim() || undefined,
    createdAt: at,
    updatedAt: at,
  };

  if (input.ageBand === "14plus") {
    if (!input.selfItems?.privacyCollection || !input.selfItems.sensitiveData) {
      throw new DomainError(
        "개인정보 수집·이용과 민감정보 처리에 각각 동의해 주세요."
      );
    }
    return saveChildConsentState({
      ...base,
      ageBand: "14plus",
      status: "granted",
      basis: "self",
      selfConsent: {
        items: { privacyCollection: true, sensitiveData: true },
        consentVersion: CONSENT_VERSION,
        consentedAt: at,
      },
    });
  }

  if (input.ageBand !== "under14") {
    throw new DomainError("만 14세 미만인지, 이상인지 골라 주세요.");
  }
  return saveChildConsentState({
    ...base,
    ageBand: "under14",
    status: "pending",
  });
}

/** Signup rollback when the account itself could not be created. */
export async function discardChildSignupConsent(childUserId: string) {
  await deleteChildConsentState(childUserId);
}

export async function getChildConsentView(
  childUserId: string
): Promise<ChildConsentView> {
  const state = await getChildConsentState(childUserId);
  if (!state) {
    return { required: false, status: "not_required", ageBand: null };
  }
  return {
    required: state.ageBand === "under14",
    status: state.status,
    ageBand: state.ageBand,
  };
}

async function childDisplayName(
  childUserId: string,
  state: ChildConsentState | null
): Promise<string> {
  const persona = await getPersonaForUser(childUserId);
  const nickname = persona.setupCompleted
    ? persona.self?.nickname?.trim() || persona.profile?.nickname?.trim()
    : undefined;
  return nickname || state?.childName || "아이";
}

function toView(input: {
  linked: boolean;
  childName: string | null;
  state: ChildConsentState | null;
  mine: GuardianConsentRecord | null;
}): GuardianConsentView {
  const { state, mine } = input;
  return {
    linked: input.linked,
    childName: input.childName,
    required: state?.ageBand === "under14",
    status: state ? state.status : "not_required",
    consentVersion: CONSENT_VERSION,
    mine: mine
      ? {
          relationship: mine.relationship,
          relationshipLabel: GUARDIAN_RELATIONSHIP_LABELS[mine.relationship],
          guardianName: mine.guardianName,
          consentedAt: mine.consentedAt,
          consentVersion: mine.consentVersion,
        }
      : null,
  };
}

async function loadForGuardian(guardianUserId: string) {
  const link = await getLinkForGuardian(guardianUserId);
  if (!link) return null;
  const [state, records] = await Promise.all([
    getChildConsentState(link.childUserId),
    listGuardianConsentsForChild(link.childUserId),
  ]);
  const mine =
    records.find((r) => r.guardianUserId === guardianUserId && isActive(r)) ??
    null;
  return { childUserId: link.childUserId, state, records, mine };
}

export async function getGuardianConsentView(
  guardianUserId: string
): Promise<GuardianConsentView> {
  const loaded = await loadForGuardian(guardianUserId);
  if (!loaded) {
    return toView({ linked: false, childName: null, state: null, mine: null });
  }
  return toView({
    linked: true,
    childName: await childDisplayName(loaded.childUserId, loaded.state),
    state: loaded.state,
    mine: loaded.mine,
  });
}

export interface GrantGuardianConsentInput {
  relationship: unknown;
  guardianName: unknown;
  items: Partial<Record<keyof GuardianConsentItems, unknown>> | null | undefined;
}

/** A linked legal guardian consents for an under-14 child → child becomes granted. */
export async function grantGuardianConsent(
  guardianUserId: string,
  input: GrantGuardianConsentInput
): Promise<GuardianConsentView> {
  const loaded = await loadForGuardian(guardianUserId);
  if (!loaded) {
    throw new DomainError("먼저 아이와 연결해 주세요.", "FORBIDDEN");
  }
  const { childUserId, state } = loaded;
  if (!state || state.ageBand !== "under14") {
    throw new DomainError(
      "이 아이는 보호자 동의가 따로 필요하지 않아요.",
      "CONFLICT"
    );
  }

  if (!isGuardianRelationship(input.relationship)) {
    throw new DomainError("아이와의 관계를 골라 주세요.");
  }
  const guardianName =
    typeof input.guardianName === "string" ? input.guardianName.trim() : "";
  if (!guardianName) {
    throw new DomainError("보호자 이름을 입력해 주세요.");
  }
  if (guardianName.length > GUARDIAN_NAME_MAX) {
    throw new DomainError(`보호자 이름은 ${GUARDIAN_NAME_MAX}자 이내로 입력해 주세요.`);
  }
  const items = input.items ?? {};
  if (
    items.privacyCollection !== true ||
    items.sensitiveData !== true ||
    items.aiFeatures !== true
  ) {
    throw new DomainError("필수 동의 항목에 모두 동의해 주세요.");
  }

  let mine = loaded.mine;
  if (!mine) {
    mine = await saveGuardianConsentRecord({
      id: `gconsent-${crypto.randomUUID()}`,
      childUserId,
      guardianUserId,
      relationship: input.relationship,
      guardianName,
      items: { privacyCollection: true, sensitiveData: true, aiFeatures: true },
      consentVersion: CONSENT_VERSION,
      consentedAt: nowIso(),
    });
  }

  const nextState = await saveChildConsentState({
    ...state,
    status: "granted",
    basis: "guardian",
    updatedAt: nowIso(),
  });

  return toView({
    linked: true,
    childName: await childDisplayName(childUserId, nextState),
    state: nextState,
    mine,
  });
}

/**
 * Withdraw this guardian's consent (동의 철회). The child goes back to
 * pending unless another legal guardian's consent is still active; in that
 * case everything collected under the consent is erased without delay
 * (account, consent records and the guardian link stay).
 */
export async function withdrawGuardianConsent(
  guardianUserId: string
): Promise<GuardianConsentView> {
  const loaded = await loadForGuardian(guardianUserId);
  if (!loaded) {
    throw new DomainError("먼저 아이와 연결해 주세요.", "FORBIDDEN");
  }
  const { childUserId, state, records, mine } = loaded;
  if (!mine || !state) {
    throw new DomainError("철회할 동의가 없어요.", "NOT_FOUND");
  }

  const at = nowIso();
  await saveGuardianConsentRecord({ ...mine, withdrawnAt: at });

  const othersActive = records.some(
    (r) => r.id !== mine.id && isActive(r)
  );
  const nextState = await saveChildConsentState({
    ...state,
    status: othersActive ? "granted" : "pending",
    basis: othersActive ? "guardian" : undefined,
    updatedAt: at,
  });
  if (!othersActive) {
    await eraseChildCollectedData(childUserId);
  }

  return toView({
    linked: true,
    childName: await childDisplayName(childUserId, nextState),
    state: nextState,
    mine: null,
  });
}
