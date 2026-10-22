import { NextResponse } from "next/server";
import { requireAuthUser } from "@/backend/shared/http/auth";
import { setPersonaReadyCookie } from "@/backend/shared/http/cookies";
import { generatePersona } from "@/backend/features/persona/persona.service";
import { parsePersonaPreferencesBody } from "@/backend/features/persona/persona.parse";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * API Bridge: Generate secret friend from self + character preferences.
 */
export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    await assertChildConsented(user.id);
    const body = await request.json();
    const preferences = parsePersonaPreferencesBody(body);
    const data = await generatePersona(user.id, preferences);

    const response = NextResponse.json(data);
    setPersonaReadyCookie(response, true);
    return response;
  }, "페르소나 생성에 실패했습니다.", "[api/persona/generate POST]");
}
