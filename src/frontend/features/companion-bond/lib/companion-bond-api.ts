export type CareType = "cheer" | "hug" | "stay";

export type CompanionBondView = {
  affinity: number;
  affinityLabel: string;
  moodId: string;
  moodLabel: string;
  moodLine: string;
  moodHint: string;
  visitStreak: number;
  totalPets: number;
  totalCares: number;
  petsRemainingToday: number;
  chatsRemainingToday: number;
  caresAvailable: CareType[];
  replyLine: string | null;
};

export type BondAction = "visit" | "pet" | "care" | "chat" | "quest";

export async function postCompanionBond(
  action: BondAction,
  careType?: CareType,
  questId?: string
): Promise<CompanionBondView | null> {
  try {
    const res = await fetch("/api/companion/bond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(careType ? { careType } : {}),
        ...(questId ? { questId } : {}),
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as CompanionBondView;
  } catch {
    return null;
  }
}

export async function fetchCompanionBond(): Promise<CompanionBondView | null> {
  try {
    const res = await fetch("/api/companion/bond", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as CompanionBondView;
  } catch {
    return null;
  }
}
