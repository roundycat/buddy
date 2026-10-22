import {
  loadChildConsentPending,
  loadHospitalDay,
} from "@/app/_server/loaders";
import { getHospitalScheduleMonth } from "@/backend/features/hospital-day/hospital-day.service";
import { HospitalScheduleView } from "@/frontend/features/hospital-day/components/HospitalScheduleView";
import { TopBrandBar } from "@/frontend/shared/components/TopBrandBar";
import { getSessionUser } from "@/backend/shared/http/auth";
import { todayKey } from "@/backend/shared/time/date";
import { ChildConsentPendingScreen } from "@/frontend/features/consent/components/ChildConsentPendingScreen";

export const dynamic = "force-dynamic";

export default async function HospitalPage() {
  // Under 14: nothing is collected or generated until a guardian consents.
  if (await loadChildConsentPending()) {
    return <ChildConsentPendingScreen showBack />;
  }
  const user = await getSessionUser();
  const [day, month] = await Promise.all([
    loadHospitalDay(),
    getHospitalScheduleMonth(user?.id, todayKey().slice(0, 7)),
  ]);

  return (
    <div className="paper-room mx-auto max-w-lg px-5  pt-2 md:max-w-2xl md:px-8">
      <TopBrandBar />

      <div className="mt-8 mb-6 text-center">
        <p className="text-xs tracking-[0.14em] text-bedi-slate/40">병원 일정</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-bedi-slate">
          보호자가 알려 준 일정
        </h1>
        <p className="mt-2 text-sm text-bedi-slate/45">
          달력이나 날짜 스크롤로 날짜별 일정을 살펴봐요
        </p>
      </div>

      <HospitalScheduleView
        initialDay={{
          dateLabel: day.dateLabel,
          companionNote: day.companionNote,
          items: day.items,
          parentItemCount: day.parentItemCount,
          dateKey: day.dateKey ?? todayKey(),
          freshDeliveries: (day.freshDeliveries ?? []).map((d) => ({
            id: d.id,
            title: d.childTitle || d.title,
            time: d.time,
            type: d.type,
            notifyText: d.notifyText,
          })),
        }}
        initialMonth={month}
      />
    </div>
  );
}
