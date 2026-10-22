import { requireAuthUser } from "@/backend/shared/http/auth";
import {
  regeneratePersonaAvatarSlot,
  regeneratePersonaAvatars,
} from "@/backend/features/persona/persona.service";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Re-draw crayon avatars.
 * - Default: 2 candidates in one call
 * - { slot: 0|1, stamp }: single slot (preferred under CloudFront 30s)
 */
export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    await assertChildConsented(user.id);
    const body = await readJsonBody<{
      slot?: unknown;
      stamp?: unknown;
    }>(request).catch(() => null);

    const slotRaw = body?.slot;
    if (typeof slotRaw === "number" || typeof slotRaw === "string") {
      const slot = Number(slotRaw);
      if (!Number.isFinite(slot) || slot < 0 || slot > 1) {
        throw new HttpError("slot은 0 또는 1이어야 해요.", 400);
      }
      const stamp =
        typeof body?.stamp === "number"
          ? body.stamp
          : typeof body?.stamp === "string" && Number.isFinite(Number(body.stamp))
            ? Number(body.stamp)
            : undefined;

      const result = await regeneratePersonaAvatarSlot(user.id, slot, stamp);
      return {
        avatarChoices: [result.choice],
        stamp: result.stamp,
      };
    }

    return regeneratePersonaAvatars(user.id);
  }, "그림을 다시 그리지 못했어요.", "[api/persona/avatar/regenerate POST]");
}
