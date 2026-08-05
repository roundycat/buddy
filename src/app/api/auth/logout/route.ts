import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/backend/shared/http/cookies";

/**
 * API Bridge: Logout — clears session + role + persona-ready cookies.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
