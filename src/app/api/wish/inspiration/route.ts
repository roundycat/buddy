import { requireAuthUser } from "@/backend/shared/http/auth";
import { withApiGuard } from "@/backend/shared/http/route";
import { suggestWishInspiration } from "@/backend/features/wish-tree/wish-tree.inspiration";

export async function GET() {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    return suggestWishInspiration(user.id);
  }, "영감을 불러오지 못했어요.", "[api/wish/inspiration GET]");
}
