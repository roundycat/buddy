import { NextResponse } from "next/server";
import { AuthError, login } from "@/backend/features/auth/auth.service";
import { isPersonaSetupCompleted } from "@/backend/features/persona/persona.service";
import {
  setAuthRoleCookie,
  setPersonaReadyCookie,
  setSessionCookie,
} from "@/backend/shared/http/cookies";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";
import {
  allowRequest,
  clientAddress,
  forgetHit,
  hasRequestRoom,
  LOGIN_FAILURE_LIMITS,
  LOGIN_IP_LIMITS,
  recordHit,
} from "@/backend/shared/http/rate-limit";

const TOO_MANY = "로그인 시도가 너무 많아요. 10분쯤 뒤에 다시 해 주세요.";

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
      // Wrong passwords count per e-mail *and* address, so guessing from one
      // place cannot lock out judges who share an account from another.
      const address = clientAddress(request);
      const emailKey = `login-fail:${email.trim().toLowerCase()}:${address}`;
      if (
        !allowRequest(`login-ip:${address}`, LOGIN_IP_LIMITS) ||
        !hasRequestRoom(emailKey, LOGIN_FAILURE_LIMITS)
      ) {
        throw new HttpError(TOO_MANY, 429);
      }

      // Counted as a failure until the password checks out, so a burst of
      // parallel guesses cannot all slip past the limit.
      const attempt = recordHit(emailKey, LOGIN_FAILURE_LIMITS);
      let result: Awaited<ReturnType<typeof login>>;
      try {
        result = await login({ email, password });
      } catch (error) {
        if (!(error instanceof AuthError && error.status === 401)) forgetHit(emailKey, attempt);
        throw error;
      }
      forgetHit(emailKey, attempt);
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
