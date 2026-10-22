import { redirect } from "next/navigation";
import { getSessionUser } from "@/backend/shared/http/auth";
import { askParentReport } from "@/backend/features/parent/parent.service";
import { ParentReportView } from "@/frontend/features/parent/report/ParentReportView";

export const dynamic = "force-dynamic";

export default async function GuardianReportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "guardian") redirect("/");

  const data = await askParentReport(user.id, "");
  // Consent form lives on the guardian home and comes first.
  if (data.consentRequired) redirect("/guardian");
  return <ParentReportView initial={data} />;
}
