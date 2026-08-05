import { Suspense } from "react";
import { redirect } from "next/navigation";
import { WaitingRoom } from "@/frontend/features/waiting-room/components/WaitingRoom";
import { loadHospitalDay, loadPersona } from "@/app/_server/loaders";
import { getSessionUser } from "@/backend/shared/http/auth";

export const dynamic = "force-dynamic";

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
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-sm text-bedi-slate/45">불러오는 중…</main>}>
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
