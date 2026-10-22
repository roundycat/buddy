import type {
  AuthUser,
  LoginRequest,
  LoginResult,
  SignupRequest,
} from "./auth.types";
import { createSessionToken, verifySessionToken } from "./auth.session";
import { env } from "@/backend/shared/config/env";
import {
  createUser,
  findUserByEmail,
  profileToAuthUser,
  verifyUserPassword,
} from "./auth.users.repo";
import { passwordValidationMessage } from "@/shared/auth/password";

/**
 * Auth Service
 *
 * Stored users: DynamoDB (AUTH_PROVIDER=dynamodb | auto) or data-directory files
 * (AUTH_PROVIDER=json, hosting without AWS). mock only when AUTH_PROVIDER=mock
 * (blocked in production).
 */

// 계정 목록이 seed-dynamo-users.js / wipe-fresh-start.js 와 중복이다.
// 하나를 바꾸면 나머지도 바꿔야 한다. 데모 후 공유 상수로 통합 예정.
/** Demo accounts — mock path only. Passwords rotated STEP 5-4. */
const MOCK_USERS: Array<
  AuthUser & { password: string; role?: "child" | "guardian" }
> = [
  {
    id: "user-demo-01",
    name: "지민",
    email: "demo@bedi.app",
    password: "BeddyDemo26!",
    role: "child",
  },
  {
    id: "user-demo-02",
    name: "서연",
    email: "guest@bedi.app",
    password: "BeddyGuest26!",
    role: "child",
  },
  {
    id: "user-demo-03",
    name: "미나",
    email: "mina@bedi.app",
    password: "BeddyMina26!",
    role: "child",
  },
  {
    id: "user-demo-04",
    name: "하루",
    email: "haru@bedi.app",
    password: "BeddyHaru26!",
    role: "child",
  },
  {
    id: "user-guardian-01",
    name: "보호자",
    email: "guardian@bedi.app",
    password: "BeddyGuard26!",
    role: "guardian",
  },
  {
    id: "user-guardian-02",
    name: "엄마",
    email: "parent@bedi.app",
    password: "BeddyParent26!",
    role: "guardian",
  },
];

/** Block AUTH_PROVIDER=mock when running a production Node build. */
function assertMockNotUsedInProduction() {
  if (env.authProvider === "mock" && process.env.NODE_ENV === "production") {
    throw new AuthError("인증 저장소에 연결할 수 없습니다.", 503);
  }
}

const INVALID_CREDENTIALS = "이메일 또는 비밀번호가 올바르지 않습니다.";

/**
 * The client always gets the same message; the log separates the two causes so a
 * production 401 can be told apart from a missing account without guessing.
 */
function rejectLogin(reason: "no_account" | "bad_password", store: string): never {
  console.warn(`[auth] login rejected (${store}): ${reason}`);
  throw new AuthError(INVALID_CREDENTIALS, 401);
}

async function loginWithStore(request: LoginRequest): Promise<LoginResult> {
  const email = request.email.trim().toLowerCase();
  const store = env.authProvider === "json" ? "json" : "dynamodb";
  const row = await findUserByEmail(email);
  if (!row) rejectLogin("no_account", store);
  if (!(await verifyUserPassword(request.password, row.passwordHash))) {
    rejectLogin("bad_password", store);
  }
  const user = profileToAuthUser(row);
  const token = await createSessionToken(user);
  return { user, token };
}

export async function login(request: LoginRequest): Promise<LoginResult> {
  const email = request.email.trim().toLowerCase();
  const password = request.password;

  if (!email || !password) {
    throw new AuthError("이메일과 비밀번호를 입력해 주세요.", 400);
  }

  if (env.authProvider === "dynamodb" || env.authProvider === "json") {
    try {
      return await loginWithStore(request);
    } catch (error) {
      if (error instanceof AuthError) throw error;
      console.error(`[auth] ${env.authProvider} login failed:`, error);
      throw new AuthError("데이터베이스 로그인에 실패했습니다.", 503);
    }
  }

  if (env.authProvider === "mock") {
    assertMockNotUsedInProduction();
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

  // Legacy auto: DynamoDB first → production 503 / development mock
  try {
    return await loginWithStore(request);
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) throw error;
  }
  if (process.env.NODE_ENV === "production") {
    throw new AuthError("인증 저장소에 연결할 수 없습니다.", 503);
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

  if (env.authProvider === "mock") {
    throw new AuthError("mock 모드에서는 회원가입을 지원하지 않습니다.", 503);
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
    console.error(`[auth] ${env.authProvider} signup failed:`, error);
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
