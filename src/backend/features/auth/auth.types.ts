/**
 * Auth domain types.
 * Future: map to Cognito / JWT claims / DynamoDB user profile.
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: "child" | "guardian";
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  role?: "child" | "guardian";
  /** Child accounts only — under 14 needs legal-guardian consent first */
  childAgeBand?: "under14" | "14plus";
  agreements?: {
    /** Guardian accounts: 만 14세 이상 */
    ageOrGuardian: boolean;
    terms: boolean;
    privacy: boolean;
    /** 14+ children: 민감정보(마음·건강 관련 기록) 처리 — separate consent */
    sensitive?: boolean;
    marketing?: boolean;
  };
}

export interface LoginResult {
  user: AuthUser;
  token: string;
}

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role?: "child" | "guardian";
  exp: number;
}
