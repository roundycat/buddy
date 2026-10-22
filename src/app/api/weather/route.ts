import { requireAuthUser } from "@/backend/shared/http/auth";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";
import {
  getWeatherForUser,
  reportCoarseLocation,
} from "@/backend/features/weather/weather.service";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";

export const dynamic = "force-dynamic";

/**
 * Server-side weather (STEP 4).
 * POST body: { lat, lon } — rounded to 1 decimal and stored with TTL.
 * GET — forecast for the signed-in child (coarse loc or hospital default).
 */
export async function GET() {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    await assertChildConsented(user);
    const weather = await getWeatherForUser(user.id);
    return {
      emoji: weather.emoji,
      label: weather.label,
      tempC: weather.tempC ?? null,
      dateKey: weather.dateKey,
      source: weather.source,
    };
  }, "날씨를 불러오지 못했어요.", "[api/weather GET]");
}

export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    await assertChildConsented(user);
    const body = await readJsonBody<{ lat?: unknown; lon?: unknown }>(request);
    const lat = typeof body?.lat === "number" ? body.lat : Number(body?.lat);
    const lon = typeof body?.lon === "number" ? body.lon : Number(body?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new HttpError("위치 정보가 올바르지 않아요.", 400);
    }
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new HttpError("위치 정보가 올바르지 않아요.", 400);
    }
    const weather = await reportCoarseLocation(user.id, lat, lon);
    return {
      emoji: weather.emoji,
      label: weather.label,
      tempC: weather.tempC ?? null,
      dateKey: weather.dateKey,
      source: weather.source,
      stored: "coarse",
    };
  }, "날씨를 불러오지 못했어요.", "[api/weather POST]");
}
