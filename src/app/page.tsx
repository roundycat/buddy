import { Suspense } from "react";
import { redirect } from "next/navigation";
import nextDynamic from "next/dynamic";
import { loadHospitalDay, loadPersona } from "@/app/_server/loaders";
import { getSessionUser } from "@/backend/shared/http/auth";
import { CompanionRoomSkeleton } from "@/frontend/shared/components/ChildUi";

export const dynamic = "force-dynamic";

const WaitingRoom = nextDynamic(
  () =>
    import(
      "@/frontend/features/waiting-room/components/WaitingRoom"
    ).then((m) => m.WaitingRoom),
  {
    loading: () => <CompanionRoomSkeleton />,
  }
);

/**
 * 메인 — Sumone 스타일 페르소나 대기실.
 * 실제 페르소나 데이터가 없으면 온보딩으로 보냅니다.
 */
export default async function HomePage() {
  const user = await getSessionUser();
  if (user?.role === "guardian") {
    redirect("/guardian");
  }

  const [{ persona, setupCompleted }, hospital] = await Promise.all([
    loadPersona(),
    loadHospitalDay(),
  ]);

  if (!setupCompleted) {
    redirect("/onboarding");
  }

  const scheduleTeaser = hospital.items
    .filter((item) => item.source === "parent" && !item.done)
    .map((item) => ({
      id: item.id,
      title: item.childTitle || item.title,
      time: item.time,
      type: item.type,
      notifyText: item.notifyText,
      explanation: item.explanation,
      whatText: item.whatText,
      whyText: item.whyText,
      imageUrl: item.imageUrl,
      imageStatus: item.imageStatus,
      done: item.done,
    }));

  const scheduleDeliveries = (hospital.freshDeliveries ?? []).map((d) => ({
    id: d.id,
    title: d.childTitle || d.title,
    time: d.time,
    type: d.type,
    notifyText: d.notifyText,
  }));

  return (
    <Suspense fallback={<CompanionRoomSkeleton />}>
      <WaitingRoom
        companionName={persona.name}
        companionRole={persona.role}
        greeting={persona.greeting}
        companionMessage={persona.companionMessage}
        prompt={persona.prompt}
        dayCount={persona.dayCount}
        avatarUrl={persona.avatarUrl}
        scheduleTeaser={scheduleTeaser}
        scheduleDeliveries={scheduleDeliveries}
      />
    </Suspense>
  );
}
