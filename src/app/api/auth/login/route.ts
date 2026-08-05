import { NextResponse } from "next/server";
import { AuthError, login } from "@/backend/features/auth/auth.service";
import { isPersonaSetupCompleted } from "@/backend/features/persona/persona.service";
import {
  setAuthRoleCookie,
  setPersonaReadyCookie,
  setSessionCookie,
} from "@/backend/shared/http/cookies";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/**
 * API Bridge: Login — thin controller.
 */
export async function POST(request: Request) {
  return withApiGuard(
    async () => {
      const body = await readJsonBody<{
      email?: unknown;
      password?: unknown;
      }>(request);
      const email = typeof body?.email === "string" ? body.email : "";
      const password = typeof body?.password === "string" ? body.password : "";

      if (!email.trim() || !password) {
        throw new HttpError("이메일과 비밀번호를 입력해 주세요.", 400);
      }

      const result = await login({ email, password });
      const isGuardian = result.user.role === "guardian";
      const needsOnboarding =
        !isGuardian && !(await isPersonaSetupCompleted(result.user.id));

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
    "로그인에 실패했습니다.",
    "[api/auth/login POST]",
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
