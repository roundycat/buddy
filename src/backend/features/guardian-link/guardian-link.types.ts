/**
 * Guardian ↔ child account linking via short invite codes.
 * TODO [AWS DynamoDB]: InviteCodeTable + GuardianChildLinkTable
 * TODO [AWS Cognito]: tie guardianId / childId to Cognito sub
 */

export interface GuardianInviteCode {
  code: string;
  childUserId: string;
  createdAt: string;
  expiresAt: string;
  /** How many successful redemptions allowed (MVP: many guardians possible, default 5) */
  maxUses: number;
  usedCount: number;
}

export interface GuardianChildLink {
  guardianUserId: string;
  childUserId: string;
  linkedAt: string;
  inviteCode: string;
}

export interface ChildInviteResponse {
  code: string;
  expiresAt: string;
  expiresLabel: string;
  hint: string;
}

export interface GuardianLinkStatus {
  linked: boolean;
  childUserId: string | null;
  childName: string | null;
  linkedAt: string | null;
}

export interface GuardianLinkResult {
  linked: true;
  childUserId: string;
  childName: string;
}
