import { requireAuthUser } from "@/backend/shared/http/auth";
import { plantTodaySeed } from "@/backend/features/emotion-garden/emotion-garden.service";
import { isMoodId } from "@/backend/features/emotion-garden/emotion-garden.flowers";
import {
  HttpError,
  readJsonBody,
  withApiGuard,
} from "@/backend/shared/http/route";

export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    const body = await readJsonBody<{ mood?: string }>(request);
    if (!isMoodId(body?.mood)) {
      throw new HttpError("오늘의 감정 씨앗을 선택해 주세요.", 400);
    }
    return plantTodaySeed(user.id, body.mood);
  }, "씨앗을 심지 못했어요.", "[api/garden/plant]");
}
