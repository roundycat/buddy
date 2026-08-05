import { NextResponse } from "next/server";
import { deleteAccount } from "@/backend/features/auth/auth.delete.service";
import {
  getSessionUser,
  unauthorizedJson,
} from "@/backend/shared/http/auth";
import { clearAuthCookies } from "@/backend/shared/http/cookies";

export const dynamic = "force-dynamic";

/**
 * API Bridge: Delete account — wipe user data, Aurora row, clear cookies.
 */
export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedJson();

    await deleteAccount(user);

    const response = NextResponse.json({ ok: true });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    console.error("[api/auth/delete-account]", error);
    return NextResponse.json(
      { error: "회원 탈퇴에 실패했습니다." },
      { status: 500 }
    );
  }
}
