import type {
  AuthUser,
  LoginRequest,
  LoginResult,
  SignupRequest,
} from "./auth.types";
import {
  createSessionToken,
  verifySessionToken,
} from "./auth.session";
import { env } from "@/backend/shared/config/env";
import { isAuroraConfigured } from "@/backend/shared/db/postgres";
import {
  createUser,
  findUserByEmail,
  toAuthUser,
  verifyPassword,
} from "./auth.users.repo";
import { passwordValidationMessage } from "@/shared/auth/password";

/**
 * Auth Service
 *
 * Current: Aurora PostgreSQL users (AUTH_PROVIDER=aurora) with mock fallback.
 * Future: Cognito / API Gateway authorizer.
 */

/** Demo accounts — used when AUTH_PROVIDER=mock or Aurora is unreachable */
const MOCK_USERS: Array<AuthUser & { password: string; role?: "child" | "guardian" }> = [
  {
    id: "user-demo-01",
    name: "지민",
    email: "demo@bedi.app",
    password: "bedi1234",
    role: "child",
  },
  {
    id: "user-demo-02",
    name: "서연",
    email: "guest@bedi.app",
    password: "guest1234",
    role: "child",
  },
  {
    id: "user-demo-03",
    name: "미나",
    email: "mina@bedi.app",
    password: "mina1234",
    role: "child",
  },
  {
    id: "user-demo-04",
    name: "하루",
    email: "haru@bedi.app",
    password: "haru1234",
    role: "child",
  },
  {
    id: "user-guardian-01",
    name: "보호자",
    email: "guardian@bedi.app",
    password: "guardian1234",
    role: "guardian",
  },
  {
    id: "user-guardian-02",
    name: "엄마",
    email: "parent@bedi.app",
    password: "parent1234",
    role: "guardian",
  },
];

async function loginWithAurora(request: LoginRequest): Promise<LoginResult> {
  const email = request.email.trim().toLowerCase();
  const row = await findUserByEmail(email);
  if (!row || !(await verifyPassword(request.password, row.password_hash))) {
    throw new AuthError("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  }
  const user = toAuthUser(row);
  const token = await createSessionToken(user);
  return { user, token };
}

export async function login(request: LoginRequest): Promise<LoginResult> {
  const email = request.email.trim().toLowerCase();
  const password = request.password;

  if (!email || !password) {
    throw new AuthError("이메일과 비밀번호를 입력해 주세요.", 400);
  }

  const preferAurora =
    env.authProvider === "aurora" ||
    (env.authProvider === "auto" && isAuroraConfigured());

  if (preferAurora && isAuroraConfigured()) {
    try {
      return await loginWithAurora(request);
    } catch (error) {
      if (error instanceof AuthError) throw error;
      console.error("[auth] Aurora login failed, falling back to mock:", error);
      if (env.authProvider === "aurora") {
        throw new AuthError("데이터베이스 로그인에 실패했습니다.", 503);
      }
    }
  }

  const found = MOCK_USERS.find(
    (u) => u.email === email && u.password === password
  );
  if (!found) {
    throw new AuthError("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  }

  const user: AuthUser = {
    id: found.id,
    name: found.name,
    email: found.email,
    role: found.role ?? "child",
  };
  const token = await createSessionToken(user);
  return { user, token };
}

/**
 * Simple email/password signup → Aurora users table.
 * TODO [AWS Cognito]: replace with SignUp + ConfirmSignUp flow.
 */
export async function signup(request: SignupRequest): Promise<LoginResult> {
  const email = request.email.trim().toLowerCase();
  const password = request.password;
  const name = request.name.trim();
  const role = request.role === "guardian" ? "guardian" : "child";

  if (!email || !password || !name) {
    throw new AuthError("이름, 이메일, 비밀번호를 입력해 주세요.", 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError("이메일 형식이 올바르지 않습니다.", 400);
  }

  const agreements = request.agreements;
  if (
    !agreements?.ageOrGuardian ||
    !agreements?.terms ||
    !agreements?.privacy
  ) {
    throw new AuthError("필수 약관에 모두 동의해 주세요.", 400);
  }

  const passwordError = passwordValidationMessage(password);
  if (passwordError) {
    throw new AuthError(passwordError, 400);
  }
  if (name.length > 20) {
    throw new AuthError("이름은 20자 이내로 입력해 주세요.", 400);
  }

  if (!isAuroraConfigured()) {
    throw new AuthError(
      "회원가입은 데이터베이스 연결이 필요합니다. 잠시 후 다시 시도해 주세요.",
      503
    );
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AuthError("이미 가입된 이메일입니다.", 409);
  }

  try {
    const user = await createUser({
      id: `user-${crypto.randomUUID()}`,
      email,
      name,
      role,
      password,
    });
    const token = await createSessionToken(user);
    return { user, token };
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_EMAIL") {
      throw new AuthError("이미 가입된 이메일입니다.", 409);
    }
    console.error("[auth] signup failed:", error);
    throw new AuthError("회원가입에 실패했습니다.", 500);
  }
}

export { createSessionToken, verifySessionToken, MOCK_USERS };

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from "./auth.constants";
