import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  AUTH_ROLE_COOKIE,
} from "@/backend/features/auth/auth.constants";
import { verifySessionToken } from "@/backend/features/auth/auth.session";
import { PERSONA_READY_COOKIE } from "@/backend/features/persona/persona.constants";

/**
 * Auth + role gate.
 * Guardian and child spaces must not mix — middleware is the hard boundary.
 */

const GUARDIAN_PREFIX = "/guardian";

const clearCookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 0,
};

function clearAuthCookies(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE_NAME, "", clearCookieOpts);
  res.cookies.set(AUTH_ROLE_COOKIE, "", clearCookieOpts);
  res.cookies.set(PERSONA_READY_COOKIE, "", clearCookieOpts);
}

function isGuardianPath(pathname: string) {
  return pathname === GUARDIAN_PREFIX || pathname.startsWith(`${GUARDIAN_PREFIX}/`);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static / API / splash — no auth gate
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon" ||
    pathname.startsWith("/icon/") ||
    pathname === "/apple-icon" ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/persona/")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = token ? await verifySessionToken(token) : null;

  // Stale/invalid session cookie → clear and treat as logged out
  if (token && !user) {
    if (pathname === "/login" || pathname === "/start") {
      const res = NextResponse.next();
      clearAuthCookies(res);
      return res;
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    const res = NextResponse.redirect(loginUrl);
    clearAuthCookies(res);
    return res;
  }

  const role = user?.role ?? request.cookies.get(AUTH_ROLE_COOKIE)?.value;
  const personaReady = request.cookies.get(PERSONA_READY_COOKIE)?.value === "1";
  const isGuardian = role === "guardian";

  // —— Start splash: always show (CTA clears session → login) ——
  if (pathname === "/start") {
    return NextResponse.next();
  }

  // —— Login: only skip form when already signed in ——
  if (pathname === "/login") {
    if (!user) return NextResponse.next();
    const dest = request.nextUrl.clone();
    dest.search = "";
    if (isGuardian) {
      dest.pathname = GUARDIAN_PREFIX;
    } else {
      dest.pathname = personaReady ? "/" : "/onboarding";
    }
    return NextResponse.redirect(dest);
  }

  // —— Unauthenticated → start (then login → onboarding) ——
  if (!user) {
    const startUrl = request.nextUrl.clone();
    startUrl.pathname = "/start";
    if (pathname !== "/" && pathname !== "/onboarding") {
      startUrl.searchParams.set("next", pathname);
    } else {
      startUrl.search = "";
    }
    return NextResponse.redirect(startUrl);
  }

  // —— Guardian: only /guardian/* ——
  if (isGuardian) {
    if (!isGuardianPath(pathname)) {
      const dest = request.nextUrl.clone();
      dest.pathname = GUARDIAN_PREFIX;
      dest.search = "";
      return NextResponse.redirect(dest);
    }
    return NextResponse.next();
  }

  // —— Child: never /guardian ——
  if (isGuardianPath(pathname)) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/";
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  // —— Child onboarding gate ——
  if (!personaReady && pathname !== "/onboarding") {
    const onboarding = request.nextUrl.clone();
    onboarding.pathname = "/onboarding";
    onboarding.search = "";
    return NextResponse.redirect(onboarding);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
