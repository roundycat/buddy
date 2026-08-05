import { requireAuthUser } from "@/backend/shared/http/auth";
import { updateAdventureProgress } from "@/backend/features/adventure-quest/adventure-quest.service";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/** Mark adventure quest progress (note / activity completion). */
export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    const body = await readJsonBody<{
      questId?: string;
      note?: string;
      photoId?: string;
      complete?: boolean;
    }>(request);

    const questId = typeof body?.questId === "string" ? body.questId.trim() : "";
    if (!questId) throw new HttpError("미션 ID가 필요해요.", 400);

    const patch: {
      note?: string;
      photoId?: string;
      completedAt?: string;
    } = {};
    if (typeof body?.note === "string") patch.note = body.note;
    if (typeof body?.photoId === "string" && body.photoId.trim()) {
      patch.photoId = body.photoId.trim();
    }
    if (body?.complete) {
      patch.completedAt = new Date().toISOString();
    }

    const adventure = await updateAdventureProgress(user.id, questId, patch);
    return { adventure };
  }, "미션을 기록하지 못했어요.", "[api/adventure/progress POST]");
}
