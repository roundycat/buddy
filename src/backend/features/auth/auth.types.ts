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
  agreements?: {
    ageOrGuardian: boolean;
    terms: boolean;
    privacy: boolean;
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
