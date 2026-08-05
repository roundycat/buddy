import type { NextResponse } from "next/server";
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  AUTH_ROLE_COOKIE,
  type AuthRoleCookieValue,
} from "@/backend/features/auth/auth.constants";
import { PERSONA_READY_COOKIE } from "@/backend/features/persona/persona.constants";

const secure = process.env.NODE_ENV === "production";

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure,
  path: "/",
};

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    ...baseCookie,
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...baseCookie,
    maxAge: 0,
  });
}

export function setAuthRoleCookie(
  response: NextResponse,
  role: AuthRoleCookieValue
) {
  response.cookies.set(AUTH_ROLE_COOKIE, role, {
    ...baseCookie,
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
}

export function clearAuthRoleCookie(response: NextResponse) {
  response.cookies.set(AUTH_ROLE_COOKIE, "", {
    ...baseCookie,
    maxAge: 0,
  });
}

export function setPersonaReadyCookie(response: NextResponse, ready: boolean) {
  if (ready) {
    response.cookies.set(PERSONA_READY_COOKIE, "1", {
      ...baseCookie,
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    response.cookies.set(PERSONA_READY_COOKIE, "", {
      ...baseCookie,
      maxAge: 0,
    });
  }
}

/** Clear all auth-related cookies */
export function clearAuthCookies(response: NextResponse) {
  clearSessionCookie(response);
  clearAuthRoleCookie(response);
  setPersonaReadyCookie(response, false);
}
