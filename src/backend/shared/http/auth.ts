import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AuthUser } from "@/backend/features/auth/auth.types";
import { AUTH_COOKIE_NAME } from "@/backend/features/auth/auth.constants";
import { verifySessionToken } from "@/backend/features/auth/auth.service";
import { accountExists } from "@/backend/features/auth/auth.users.repo";

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "로그인이 필요합니다.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Resolve the current session user from the auth cookie (App Router / Route Handlers).
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySessionToken(token);
  // A deleted account's cookie (another tab or device) is no longer a session.
  if (!user || !(await accountExists(user.id))) return null;
  return user;
}

/**
 * Require an authenticated user or throw UnauthorizedError.
 */
export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireGuardianUser(): Promise<AuthUser> {
  const user = await requireAuthUser();
  if (user.role !== "guardian") {
    throw new UnauthorizedError("보호자 계정으로 로그인해 주세요.");
  }
  return user;
}

export async function requireChildUser(): Promise<AuthUser> {
  const user = await requireAuthUser();
  if (user.role === "guardian") {
    throw new UnauthorizedError("아이 계정으로 로그인해 주세요.");
  }
  return user;
}

export function unauthorizedJson(error?: unknown) {
  const message =
    error instanceof UnauthorizedError
      ? error.message
      : "로그인이 필요합니다.";
  return NextResponse.json({ error: message }, { status: 401 });
}
