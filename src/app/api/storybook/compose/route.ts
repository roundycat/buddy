import { requireChildUser } from "@/backend/shared/http/auth";
import { composeDischargeTale } from "@/backend/features/growth-storybook/growth-storybook.service";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";
import { withApiGuard } from "@/backend/shared/http/route";

export const dynamic = "force-dynamic";

/**
 * Compose & seal the hopeful discharge fairy-tale storybook.
 */
export async function POST() {
  return withApiGuard(async () => {
    const user = await requireChildUser();
    await assertChildConsented(user);
    const book = await composeDischargeTale(user.id);
    return { book };
  }, "이야기 책을 완성하지 못했어요.", "[api/storybook/compose POST]");
}
