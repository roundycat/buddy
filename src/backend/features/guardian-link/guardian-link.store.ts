import { createMapStore } from "@/backend/shared/persist/map-store";
import type {
  GuardianChildLink,
  GuardianInviteCode,
} from "./guardian-link.types";

const invites = createMapStore<GuardianInviteCode>("guardian-invites.json", {
  userIdKey: "childUserId",
});

const links = createMapStore<GuardianChildLink>("guardian-links.json", {
  userIdKey: "guardianUserId",
});

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function getInviteByCode(
  code: string
): Promise<GuardianInviteCode | undefined> {
  return invites.get(normalizeCode(code));
}

export async function getActiveInviteForChild(
  childUserId: string
): Promise<GuardianInviteCode | undefined> {
  const now = Date.now();
  const all = await invites.values();
  return all
    .filter(
      (inv) =>
        inv.childUserId === childUserId &&
        new Date(inv.expiresAt).getTime() > now &&
        inv.usedCount < inv.maxUses
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
}

export async function saveInvite(
  invite: GuardianInviteCode
): Promise<GuardianInviteCode> {
  return invites.set(invite.code, invite);
}

export async function bumpInviteUse(
  code: string
): Promise<GuardianInviteCode | undefined> {
  const invite = await invites.get(normalizeCode(code));
  if (!invite) return undefined;
  const next = { ...invite, usedCount: invite.usedCount + 1 };
  return invites.set(next.code, next);
}

export async function getLinkForGuardian(
  guardianUserId: string
): Promise<GuardianChildLink | undefined> {
  return links.get(guardianUserId);
}

export async function saveLink(
  link: GuardianChildLink
): Promise<GuardianChildLink> {
  return links.set(link.guardianUserId, link);
}

export async function clearLinkForGuardian(guardianUserId: string) {
  await links.delete(guardianUserId);
}

export async function countGuardiansForChild(childUserId: string): Promise<number> {
  const allLinks = await links.values();
  return allLinks.filter((link) => link.childUserId === childUserId).length;
}

export async function clearGuardianDataForUser(userId: string) {
  await links.delete(userId);

  const allLinks = await links.values();
  await Promise.all(
    allLinks
      .filter((link) => link.childUserId === userId)
      .map((link) => links.delete(link.guardianUserId))
  );

  const allInvites = await invites.values();
  await Promise.all(
    allInvites
      .filter((inv) => inv.childUserId === userId)
      .map((inv) => invites.delete(inv.code))
  );
}
