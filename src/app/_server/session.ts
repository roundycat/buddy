import "server-only";
import { redirect } from "next/navigation";
import type { AuthUser } from "@/backend/features/auth/auth.types";
import { getSessionUser } from "@/backend/shared/http/auth";

/**
 * Pages that need a signed-in account. A signed cookie whose account is gone
 * (deleted on another device) gets "/login?reauth=1": the middleware clears the
 * cookies there instead of bouncing back, so the user can sign in again.
 */
export async function requirePageUser(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login?reauth=1");
  return user;
}
