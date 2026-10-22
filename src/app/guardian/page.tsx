import { redirect } from "next/navigation";
import { getSessionUser } from "@/backend/shared/http/auth";
import { getParentHome } from "@/backend/features/parent/parent.service";
import { ParentHomeView } from "@/frontend/features/parent/home/ParentHomeView";

export const dynamic = "force-dynamic";

/**
 * Parent Home — “How was my child today?”
 */
export default async function GuardianHomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?reauth=1");
  if (user.role !== "guardian") redirect("/");

  const data = await getParentHome(user.id);
  return <ParentHomeView data={data} />;
}
