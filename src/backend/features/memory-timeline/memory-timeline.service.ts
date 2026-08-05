import type { MemoryTimelineResponse } from "./memory-timeline.types";
import { listMemoryEvents } from "./memory-timeline.store";
import { getPersonaForUser } from "@/backend/features/persona/persona.store";

/**
 * Memory Timeline — real adventure / life events for the signed-in child.
 * Seed journey only used when the user has no personal events yet.
 */
export async function getMemoryTimeline(
  userId?: string
): Promise<MemoryTimelineResponse> {
  if (!userId) {
    return {
      title: "함께 기억하는 시간",
      companionNote:
        "로그인하면 모험과 하루 이야기가 여기에 쌓여요.",
      events: [],
    };
  }

  const [userEvents, persona] = await Promise.all([
    listMemoryEvents(userId),
    getPersonaForUser(userId),
  ]);

  const companionName = persona.name?.trim() || "Beddy";
  const bootstrap =
    userEvents.length === 0
      ? [
          {
            id: `boot-friend-${userId}`,
            type: "friend" as const,
            title: `${companionName}와의 시작`,
            summary: `${companionName}와 처음 인사를 나눈 날. 퇴원까지 함께하기로 약속했어요.`,
            occurredAt: new Date().toISOString(),
          },
        ]
      : [];

  const events = [...userEvents, ...bootstrap].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  const adventureCount = userEvents.filter((e) => e.type === "adventure").length;

  return {
    title: "함께 기억하는 시간",
    companionNote:
      adventureCount > 0
        ? `오늘의 작은 모험이 이야기로 쌓이고 있어요. 지금까지 ${adventureCount}편의 모험 기록이 있어요.`
        : "입원 기간의 순간들을 시간 순으로 모아 두었어요. 미션을 마치면 AI가 하루의 이야기를 여기에도 남겨 줘요.",
    events,
  };
}
