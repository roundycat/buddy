import { requireAuthUser } from "@/backend/shared/http/auth";
import { waterPlant } from "@/backend/features/emotion-garden/emotion-garden.service";
import {
  HttpError,
  readJsonBody,
  withApiGuard,
} from "@/backend/shared/http/route";

/** Give one plant a gentle watering (mood care). */
export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    const body = await readJsonBody<{ plantId?: string }>(request);
    if (!body?.plantId) {
      throw new HttpError("어떤 자리에 물을 줄지 알려 주세요.", 400);
    }
    return waterPlant(user.id, body.plantId);
  }, "물을 주지 못했어요.", "[api/garden/water]");
}
