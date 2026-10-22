import { redirect } from "next/navigation";
import { getSessionUser } from "@/backend/shared/http/auth";
import { getParentTimeline } from "@/backend/features/parent/parent.service";
import { ParentTimelineView } from "@/frontend/features/parent/timeline/ParentTimelineView";

export const dynamic = "force-dynamic";

export default async function GuardianTimelinePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?reauth=1");
  if (user.role !== "guardian") redirect("/");

  const data = await getParentTimeline(user.id);
  // Consent form lives on the guardian home and comes first.
  if (data.consentRequired) redirect("/guardian");
  return <ParentTimelineView data={data} />;
}
