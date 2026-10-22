import { requireAuthUser } from "@/backend/shared/http/auth";
import { getWallet } from "@/backend/features/wallet/wallet.service";
import { withApiGuard } from "@/backend/shared/http/route";
import { assertChildConsented } from "@/backend/features/consent/consent.guard";

export const dynamic = "force-dynamic";

/** API Bridge: Wallet balance + ledger */
export async function GET() {
  return withApiGuard(async () => {
    const user = await requireAuthUser();
    await assertChildConsented(user);
    return getWallet(user.id);
  }, "지갑 정보를 불러오지 못했어요.", "[api/wallet GET]");
}
