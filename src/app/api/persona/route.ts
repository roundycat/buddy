import { getSessionUser } from "@/backend/shared/http/auth";
import { getPersona } from "@/backend/features/persona/persona.service";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/**
 * API Bridge: Persona
 */
export async function GET() {
  return withApiGuard(async () => {
    const user = await getSessionUser();
    return getPersona(user?.id);
  }, "동반자 정보를 불러올 수 없습니다.", "[api/persona]");
}
