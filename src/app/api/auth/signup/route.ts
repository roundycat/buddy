import { NextResponse } from "next/server";
import { AuthError, signup } from "@/backend/features/auth/auth.service";
import {
  setAuthRoleCookie,
  setPersonaReadyCookie,
  setSessionCookie,
} from "@/backend/shared/http/cookies";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";
import { allowRequest, clientAddress, SIGNUP_IP_LIMITS } from "@/backend/shared/http/rate-limit";

export const dynamic = "force-dynamic";

/**
 * API Bridge: Signup — create DynamoDB user + session cookies.
 */
export async function POST(request: Request) {
  return withApiGuard(
    async () => {
      const body = await readJsonBody<{
        email?: unknown;
        password?: unknown;
        name?: unknown;
        role?: unknown;
        childAgeBand?: unknown;
        agreements?: {
          ageOrGuardian?: unknown;
          terms?: unknown;
          privacy?: unknown;
          sensitive?: unknown;
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
      const childAgeBand =
        body?.childAgeBand === "under14" || body?.childAgeBand === "14plus"
          ? body.childAgeBand
          : undefined;
      const agreements = {
        ageOrGuardian: body?.agreements?.ageOrGuardian === true,
        terms: body?.agreements?.terms === true,
        privacy: body?.agreements?.privacy === true,
        sensitive: body?.agreements?.sensitive === true,
        marketing: body?.agreements?.marketing === true,
      };

      if (!email.trim() || !password || !name.trim()) {
        throw new HttpError("이름, 이메일, 비밀번호를 입력해 주세요.", 400);
      }
      if (!allowRequest(`signup-ip:${clientAddress(request)}`, SIGNUP_IP_LIMITS)) {
        throw new HttpError("가입 요청이 너무 많아요. 잠시 후 다시 해 주세요.", 429);
      }

      const result = await signup({
        email,
        password,
        name,
        role,
        childAgeBand,
        agreements,
      });
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
