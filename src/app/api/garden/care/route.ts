import { requireAuthUser } from "@/backend/shared/http/auth";
import { waterPlant } from "@/backend/features/emotion-garden/emotion-garden.service";
import {
  HttpError,
  readJsonBody,
  withApiGuard,
} from "@/backend/shared/http/route";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";

/** Legacy alias → waterPlant (day-arc model no longer takes a mood). */
export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    await assertChildConsented(user);
    const body = await readJsonBody<{ plantId?: string }>(request);
    if (!body?.plantId) {
      throw new HttpError("어떤 자리에 물을 줄지 알려 주세요.", 400);
    }
    const result = await waterPlant(user.id, body.plantId);
    return { ...result, cared: result.watered };
  }, "기분을 주지 못했어요.", "[api/garden/care]");
}
