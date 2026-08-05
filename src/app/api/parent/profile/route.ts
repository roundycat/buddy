import { requireGuardianUser } from "@/backend/shared/http/auth";
import {
  getParentProfile,
  updateParentProfileSettings,
} from "@/backend/features/parent/parent.service";
import { readJsonBody, withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    return getParentProfile(user.id, {
      name: user.name,
      email: user.email,
    });
  }, "프로필을 불러오지 못했어요.", "[api/parent/profile GET]");
}

export async function PATCH(request: Request) {
  return withApiGuard(async () => {
    const user = await requireGuardianUser();
    const body = await readJsonBody<{
      notifications?: {
        dailyDigest?: unknown;
        careTips?: unknown;
      };
      privacy?: {
        shareEmotionTrends?: unknown;
        shareAdventures?: unknown;
        shareMemoryHighlights?: unknown;
      };
    }>(request);

    const notifications: {
      dailyDigest?: boolean;
      careTips?: boolean;
    } = {};
    if (typeof body?.notifications?.dailyDigest === "boolean") {
      notifications.dailyDigest = body.notifications.dailyDigest;
    }
    if (typeof body?.notifications?.careTips === "boolean") {
      notifications.careTips = body.notifications.careTips;
    }

    const privacy: {
      shareEmotionTrends?: boolean;
      shareAdventures?: boolean;
      shareMemoryHighlights?: boolean;
    } = {};
    if (typeof body?.privacy?.shareEmotionTrends === "boolean") {
      privacy.shareEmotionTrends = body.privacy.shareEmotionTrends;
    }
    if (typeof body?.privacy?.shareAdventures === "boolean") {
      privacy.shareAdventures = body.privacy.shareAdventures;
    }
    if (typeof body?.privacy?.shareMemoryHighlights === "boolean") {
      privacy.shareMemoryHighlights = body.privacy.shareMemoryHighlights;
    }

    const updated = await updateParentProfileSettings(user.id, {
      notifications:
        Object.keys(notifications).length > 0 ? notifications : undefined,
      privacy: Object.keys(privacy).length > 0 ? privacy : undefined,
    });

    return {
      notifications: {
        dailyDigest: updated.dailyDigest,
        careTips: updated.careTips,
      },
      privacy: updated.privacy,
    };
  }, "설정을 저장하지 못했어요.", "[api/parent/profile PATCH]");
}
