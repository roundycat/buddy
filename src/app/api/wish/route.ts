import { requireAuthUser } from "@/backend/shared/http/auth";
import {
  addWish,
  getWishTree,
  removeWish,
} from "@/backend/features/wish-tree/wish-tree.service";
import { isWishKind } from "@/backend/features/wish-tree/wish-tree.leaves";
import type { WishHorizon } from "@/backend/features/wish-tree/wish-tree.types";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";
import { HttpError, readJsonBody, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    return getWishTree(user.id);
  }, "마음 나무를 불러오지 못했어요.", "[api/wish GET]");
}

export async function POST(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    await assertChildConsented(user);
    const body = await readJsonBody<{
      text?: string;
      horizon?: WishHorizon;
      kind?: string;
    }>(request);
    const text = typeof body?.text === "string" ? body.text : "";
    const horizon =
      body?.horizon === "hospital" ||
      body?.horizon === "after_discharge" ||
      body?.horizon === "anytime"
        ? body.horizon
        : "anytime";
    const kind = isWishKind(body?.kind) ? body.kind : undefined;

    return addWish(user.id, text, horizon, kind);
  }, "잎을 걸지 못했어요.", "[api/wish POST]");
}

export async function DELETE(request: Request) {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    const body = await readJsonBody<{ wishId?: string }>(request);
    const wishId = typeof body?.wishId === "string" ? body.wishId : "";
    if (!wishId) {
      throw new HttpError("잎 ID가 필요해요.", 400);
    }

    return removeWish(user.id, wishId);
  }, "잎을 내리지 못했어요.", "[api/wish DELETE]");
}
