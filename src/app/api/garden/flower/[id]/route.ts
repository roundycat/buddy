import { requireAuthUser } from "@/backend/shared/http/auth";
import { getFlowerMemoryCard } from "@/backend/features/emotion-garden/emotion-garden.memory";
import { HttpError, withApiGuard } from "@/backend/shared/http/route";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    const params = await Promise.resolve(context.params);
    const card = await getFlowerMemoryCard(user.id, params.id);
    if (!card) {
      throw new HttpError("그 꽃의 기억을 찾지 못했어요.", 404);
    }
    return card;
  }, "기억을 불러오지 못했어요.", "[api/garden/flower]");
}
