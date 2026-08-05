import { requireAuthUser } from "@/backend/shared/http/auth";
import {
  applyCompanionBondAction,
  getCompanionBond,
} from "@/backend/features/companion-bond/bond.service";
import type {
  BondAction,
  CareType,
} from "@/backend/features/companion-bond/bond.types";
import {
  HttpError,
  readJsonBody,
  withApiGuard,
} from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

const ACTIONS: BondAction[] = ["visit", "pet", "care", "chat", "quest"];
const CARES: CareType[] = ["cheer", "hug", "stay"];

export async function GET() {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    return getCompanionBond(user.id);
  }, "유대감을 불러오지 못했어요.", "[api/companion/bond GET]");
}

export async function POST(request: Request) {
  return withApiGuard(
    async () => {
      const user = await requireAuthUser();
      const body = await readJsonBody<{
        action?: unknown;
        careType?: unknown;
        questId?: unknown;
      }>(request);

      const action =
        typeof body?.action === "string" ? (body.action as BondAction) : null;
      if (!action || !ACTIONS.includes(action)) {
        throw new HttpError("잘못된 요청이에요.", 400);
      }

      const careType =
        typeof body?.careType === "string"
          ? (body.careType as CareType)
          : undefined;
      if (action === "care") {
        if (!careType || !CARES.includes(careType)) {
          throw new HttpError("챙기기 종류를 알려 주세요.", 400);
        }
      }

      const questId =
        typeof body?.questId === "string" ? body.questId.trim() : undefined;
      if (action === "quest" && !questId) {
        throw new HttpError("미션 ID가 필요해요.", 400);
      }

      return applyCompanionBondAction(user.id, action, careType, questId);
    },
    "유대감을 쌓지 못했어요.",
    "[api/companion/bond POST]"
  );
}
