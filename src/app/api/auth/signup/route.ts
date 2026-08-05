import { NextResponse } from "next/server";
import { AuthError, signup } from "@/backend/features/auth/auth.service";
import {
  setAuthRoleCookie,
  setPersonaReadyCookie,
  setSessionCookie,
} from "@/backend/shared/http/cookies";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/**
 * API Bridge: Signup — create Aurora user + session cookies.
 */
export async function POST(request: Request) {
  return withApiGuard(
    async () => {
      const body = await readJsonBody<{
        email?: unknown;
        password?: unknown;
        name?: unknown;
        role?: unknown;
        agreements?: {
          ageOrGuardian?: unknown;
          terms?: unknown;
          privacy?: unknown;
          marketing?: unknown;
        };
      }>(request);

      const email = typeof body?.email === "string" ? body.email : "";
      const password = typeof body?.password === "string" ? body.password : "";
      const name = typeof body?.name === "string" ? body.name : "";
      const role =
        body?.role === "guardian" || body?.role === "child"
          ? body.role
          : "child";
      const agreements = {
        ageOrGuardian: body?.agreements?.ageOrGuardian === true,
        terms: body?.agreements?.terms === true,
        privacy: body?.agreements?.privacy === true,
        marketing: body?.agreements?.marketing === true,
      };

      if (!email.trim() || !password || !name.trim()) {
        throw new HttpError("이름, 이메일, 비밀번호를 입력해 주세요.", 400);
      }

      const result = await signup({ email, password, name, role, agreements });
      const isGuardian = result.user.role === "guardian";
      // New child accounts always need onboarding.
      const needsOnboarding = !isGuardian;

      const response = NextResponse.json({
        user: result.user,
        needsOnboarding,
        isGuardian,
      });

      setSessionCookie(response, result.token);
      setAuthRoleCookie(response, isGuardian ? "guardian" : "child");
      setPersonaReadyCookie(response, isGuardian || !needsOnboarding);

      return response;
    },
    "회원가입에 실패했습니다.",
    "[api/auth/signup POST]",
    500,
    (error) => {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        );
      }
      return null;
    }
  );
}
