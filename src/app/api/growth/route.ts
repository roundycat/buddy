import { getGrowthJournal } from "@/backend/features/growth-journal/growth-journal.service";
import { getSessionUser } from "@/backend/shared/http/auth";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/**
 * API Bridge: Emotion & growth journal
 */
export async function GET() {
  return withApiGuard(async () => {
    const user = await getSessionUser();
    // Moments are polished by the LLM
    if (user) await assertChildConsented(user.id);
    return getGrowthJournal(user?.id);
  }, "감정·성장 기록을 불러올 수 없습니다.", "[api/growth]");
}
