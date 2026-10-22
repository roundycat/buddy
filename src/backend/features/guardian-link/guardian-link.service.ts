import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import { clearParentPrepForGuardian } from "@/backend/features/parent/parent-daily-prep.store";
import { clearEmpathyGuidesForGuardian } from "@/backend/features/parent/parent-empathy-guide.store";

import {

  bumpInviteUse,

  getActiveInviteForChild,

  getInviteByCode,

  getLinkForGuardian,

  normalizeCode,

  saveInvite,

  saveLink,

  clearLinkForGuardian,

} from "./guardian-link.store";

import type {

  ChildInviteResponse,

  GuardianLinkResult,

  GuardianLinkStatus,

} from "./guardian-link.types";



const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const CODE_LENGTH = 6;
const INVITE_TTL_MS = 1000 * 60 * 60 * 48; // 48h
/** Two legal guardians at most per code; the child can make a new code any time. */
const MAX_USES = 2;

/** Per-process redeem throttle — stops online guessing of 6-char codes. */
const REDEEM_WINDOW_MS = 60_000;
const REDEEM_MAX_PER_WINDOW = 8;
const redeemAttempts = new Map<string, { count: number; resetAt: number }>();

function assertRedeemRateLimit(guardianUserId: string): void {
  const now = Date.now();
  const entry = redeemAttempts.get(guardianUserId);
  if (!entry || entry.resetAt <= now) {
    redeemAttempts.set(guardianUserId, {
      count: 1,
      resetAt: now + REDEEM_WINDOW_MS,
    });
    return;
  }
  entry.count += 1;
  if (entry.count > REDEEM_MAX_PER_WINDOW) {
    throw new Error(
      "초대 코드 입력을 너무 많이 시도했어요. 잠시 후 다시 해 주세요."
    );
  }
}



function randomCode(): string {
  // CSPRNG — Math.random is not acceptable for invite link entropy.
  const bytes = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]!;
  }
  return out;
}



function formatExpiresLabel(iso: string): string {

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return "";

  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}까지`;

}



async function childDisplayName(childUserId: string): Promise<string> {

  const persona = await getPersonaForUser(childUserId);

  return (

    persona.self?.nickname?.trim() ||

    persona.callName ||

    persona.name ||

    "아이"

  );

}



/** Resolve linked child for guardian dashboard. null = not linked yet. */

export async function resolveLinkedChildUserId(

  guardianUserId?: string

): Promise<string | null> {

  if (!guardianUserId) return null;

  const link = await getLinkForGuardian(guardianUserId);

  return link?.childUserId ?? null;

}



export async function getGuardianLinkStatus(

  guardianUserId: string

): Promise<GuardianLinkStatus> {

  const link = await getLinkForGuardian(guardianUserId);

  if (!link) {

    return {

      linked: false,

      childUserId: null,

      childName: null,

      linkedAt: null,

    };

  }

  return {

    linked: true,

    childUserId: link.childUserId,

    childName: await childDisplayName(link.childUserId),

    linkedAt: link.linkedAt,

  };

}



/**

 * Child creates or reuses an active invite code to show parents.

 */

export async function getOrCreateChildInvite(

  childUserId: string

): Promise<ChildInviteResponse> {

  const existing = await getActiveInviteForChild(childUserId);

  if (existing) {

    return {

      code: existing.code,

      expiresAt: existing.expiresAt,

      expiresLabel: formatExpiresLabel(existing.expiresAt),

      hint: "보호자 휴대폰에 이 코드를 알려 주세요",

    };

  }



  let code = randomCode();

  // Extremely unlikely collision; retry a few times

  for (let i = 0; i < 5 && (await getInviteByCode(code)); i++) {

    code = randomCode();

  }



  const now = new Date();

  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS).toISOString();

  await saveInvite({

    code,

    childUserId,

    createdAt: now.toISOString(),

    expiresAt,

    maxUses: MAX_USES,

    usedCount: 0,

  });



  return {

    code,

    expiresAt,

    expiresLabel: formatExpiresLabel(expiresAt),

    hint: "보호자 휴대폰에 이 코드를 알려 주세요",

  };

}



/**

 * Force a fresh invite (invalidates reuse of previous active code by replacing).

 */

export async function rotateChildInvite(

  childUserId: string

): Promise<ChildInviteResponse> {

  // Expire previous actives by bumping usedCount to max

  const active = await getActiveInviteForChild(childUserId);

  if (active) {

    await saveInvite({ ...active, usedCount: active.maxUses });

  }

  return getOrCreateChildInvite(childUserId);

}



export async function linkGuardianWithCode(
  guardianUserId: string,
  rawCode: string
): Promise<GuardianLinkResult> {
  assertRedeemRateLimit(guardianUserId);

  const code = normalizeCode(rawCode);

  if (code.length < 4) {

    throw new Error("초대 코드를 입력해 주세요.");

  }



  const invite = await getInviteByCode(code);

  if (!invite) {

    throw new Error("코드를 찾을 수 없어요. 아이에게 다시 확인해 주세요.");

  }

  if (new Date(invite.expiresAt).getTime() < Date.now()) {

    throw new Error("코드가 만료됐어요. 아이에게 새 코드를 받아 주세요.");

  }

  if (invite.usedCount >= invite.maxUses) {

    throw new Error("이 코드는 더 이상 쓸 수 없어요. 새 코드를 받아 주세요.");

  }



  await bumpInviteUse(code);

  const linkedAt = new Date().toISOString();

  await saveLink({

    guardianUserId,

    childUserId: invite.childUserId,

    linkedAt,

    inviteCode: code,

  });



  return {

    linked: true,

    childUserId: invite.childUserId,

    childName: await childDisplayName(invite.childUserId),

  };

}



/**
 * Unlink: the guardian also loses what was prepared from the child's records
 * (daily summary, empathy guides). Their own settings stay.
 */
export async function unlinkGuardian(guardianUserId: string) {
  await clearLinkForGuardian(guardianUserId);
  await Promise.all([
    clearParentPrepForGuardian(guardianUserId),
    clearEmpathyGuidesForGuardian(guardianUserId),
  ]);
}

