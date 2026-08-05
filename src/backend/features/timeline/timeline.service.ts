import { getHospitalDay } from "@/backend/features/hospital-day/hospital-day.service";
import { getAdventureQuest } from "@/backend/features/adventure-quest/adventure-quest.service";
import { getGardenAccount } from "@/backend/features/emotion-garden/emotion-garden.store";
import { MOOD_OPTIONS } from "@/backend/features/emotion-garden/emotion-garden.service";
import { todayKey } from "@/backend/shared/time/date";
import type {
  DailyChallenge,
  GetTimelineResponse,
  MedicationEntry,
  TimelineEvent,
} from "./timeline.types";

/**
 * Timeline — hospital schedule + today's adventure + garden check-in.
 * Replaces hardcoded medication / challenge mocks.
 */
export async function getTimeline(
  userId?: string
): Promise<GetTimelineResponse> {
  if (!userId) {
    return { medications: [], challenges: [], events: [] };
  }

  const [hospital, adventure, garden] = await Promise.all([
    getHospitalDay(userId),
    getAdventureQuest(userId),
    getGardenAccount(userId),
  ]);

  const day = todayKey();

  const medications: MedicationEntry[] = hospital.items
    .filter((item) => item.type === "exam" || item.type === "treatment")
    .map((item) => ({
      id: item.id,
      name: item.childTitle || item.title,
      dosage: item.type === "treatment" ? "치료" : "검사",
      scheduledAt: item.time || "—",
      status: item.done ? ("taken" as const) : ("scheduled" as const),
      notes: item.whatText || item.explanation,
    }));

  const challenges: DailyChallenge[] = adventure.quests.map((q) => {
    let status: DailyChallenge["status"] = "pending";
    if (q.status === "done") status = "completed";
    else if (q.readyToClaim || q.progress?.completedAt) status = "in_progress";

    const category: DailyChallenge["category"] =
      q.kind === "garden"
        ? "reflection"
        : q.kind === "chat"
          ? "connection"
          : q.kind === "observe"
            ? "rest"
            : "movement";

    return {
      id: q.id,
      title: q.title,
      description: q.hint,
      status,
      category,
    };
  });

  const events: TimelineEvent[] = [];

  for (const item of hospital.items) {
    events.push({
      id: `ev-${item.id}`,
      timestamp: `${item.dateKey}T${(item.time || "12:00").padStart(5, "0")}:00Z`,
      type: item.type === "exam" || item.type === "treatment" ? "medication" : "note",
      title: item.childTitle || item.title,
      summary: item.whatText || item.explanation || "보호자가 알려 준 일정",
    });
  }

  for (const q of adventure.quests) {
    events.push({
      id: `ev-${q.id}`,
      timestamp: `${day}T10:00:00Z`,
      type: "challenge",
      title: q.title,
      summary:
        q.status === "done"
          ? "완료. 작은 모험을 마쳤어요."
          : q.readyToClaim
            ? "진행 중 — 보상을 받을 수 있어요."
            : q.hint,
    });
  }

  const todayFlower = garden.flowers.find((f) => f.plantedOn === day);
  if (todayFlower) {
    const meta = MOOD_OPTIONS.find((m) => m.id === todayFlower.mood);
    events.push({
      id: `ev-${todayFlower.id}`,
      timestamp: `${day}T18:00:00Z`,
      type: "note",
      title: "오늘의 감정 꽃",
      summary: `${meta?.label ?? todayFlower.mood} · ${todayFlower.name}`,
    });
  }

  events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return { medications, challenges, events };
}
