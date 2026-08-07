import { requireAuthUser } from "@/backend/shared/http/auth";
import { sealGardenStorybook } from "@/backend/features/emotion-garden/emotion-garden.service";
import { withApiGuard } from "@/backend/shared/http/route";

/** Seal the garden into a storybook (discharge metaphor). */
export async function POST() {
  return withApiGuard(
    async () => {
      const user = await requireAuthUser();
      return sealGardenStorybook(user.id);
    },
    "스토리북에 넣지 못했어요.",
    "[api/garden/storybook]"
  );
}
