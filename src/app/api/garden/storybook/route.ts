import { requireAuthUser } from "@/backend/shared/http/auth";
import { sealGardenStorybook } from "@/backend/features/emotion-garden/emotion-garden.service";
import { withApiGuard } from "@/backend/shared/http/route";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";

/** Seal the garden into a storybook (discharge metaphor). */
export async function POST() {
  return withApiGuard(
    async () => {
      const user = await requireAuthUser();
      await assertChildConsented(user);
      return sealGardenStorybook(user.id);
    },
    "스토리북에 넣지 못했어요.",
    "[api/garden/storybook]"
  );
}
