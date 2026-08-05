import "server-only";
import { timingSafeEqual } from "crypto";
import { env } from "@/backend/shared/config/env";
import { HttpError } from "@/backend/shared/http/route";

/**
 * Protect /api/cron/* with shared secret header.
 * Header: x-bedi-cron-secret: <CRON_SECRET>
 */
export function assertCronAuthorized(request: Request): void {
  const expected = env.cronSecret;
  if (!expected) {
    throw new HttpError("CRON_SECRET이 설정되지 않았습니다.", 503);
  }
  const got = request.headers.get("x-bedi-cron-secret")?.trim() ?? "";
  if (!got || got.length !== expected.length) {
    throw new HttpError("Unauthorized cron", 401);
  }
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (!timingSafeEqual(a, b)) {
    throw new HttpError("Unauthorized cron", 401);
  }
}
