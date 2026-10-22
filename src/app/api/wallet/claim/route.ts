import { requireAuthUser } from "@/backend/shared/http/auth";
import { claimQuestReward } from "@/backend/features/wallet/wallet.service";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";

export const dynamic = "force-dynamic";

/** API Bridge: Claim mission / quest reward → 별조각 */
export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    await assertChildConsented(user);
    const body = await readJsonBody<{ questId?: string }>(request);
    const questId = typeof body?.questId === "string" ? body.questId.trim() : "";

    if (!questId) {
      throw new HttpError("미션 ID가 필요해요.", 400);
    }

    return claimQuestReward(user.id, questId);
  }, "보상을 받지 못했어요.", "[api/wallet/claim POST]");
}
