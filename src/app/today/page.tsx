import { PersonaGreeting } from "@/frontend/features/persona/components/PersonaGreeting";
import { MedicationLog } from "@/frontend/features/timeline/components/MedicationLog";
import { MoodCheckIn } from "@/frontend/features/mood/components/MoodCheckIn";
import { TopBrandBar } from "@/frontend/shared/components/TopBrandBar";
import { loadPersona, loadTimeline } from "@/app/_server/loaders";

export const dynamic = "force-dynamic";

/**
 * 오늘의 공간 — 복약, 기분 체크인, 동반자 인사.
 */
export default async function TodayPage() {
  const [personaData, timelineData] = await Promise.all([
    loadPersona(),
    loadTimeline(),
  ]);

  const { persona } = personaData;
  const { medications } = timelineData;

  return (
    <div className="paper-room mx-auto max-w-lg px-5 pb-8 pt-2">
      <TopBrandBar />

      <div className="mt-8 mb-6 text-center">
        <p className="text-xs tracking-[0.14em] text-bedi-slate/40">오늘의 공간</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-bedi-slate">
          천천히, 필요한 것만
        </h1>
      </div>

      <div className="space-y-5">
        <PersonaGreeting
          name={persona.name}
          role={persona.role}
          greeting={persona.greeting}
          companionMessage={persona.companionMessage}
        />

        <MedicationLog medications={medications} />
        <MoodCheckIn />
      </div>
    </div>
  );
}
