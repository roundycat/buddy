import { redirect } from "next/navigation";
import { getSessionUser } from "@/backend/shared/http/auth";
import { getParentProfile } from "@/backend/features/parent/parent.service";
import { ParentProfileView } from "@/frontend/features/parent/profile/ParentProfileView";

export const dynamic = "force-dynamic";

export default async function GuardianProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?reauth=1");
  if (user.role !== "guardian") redirect("/");

  const data = await getParentProfile(user.id, {
    name: user.name,
    email: user.email,
  });
  return <ParentProfileView data={data} />;
}
