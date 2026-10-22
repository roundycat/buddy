export type CareType = "cheer" | "hug" | "stay";

export type BondAction = "visit" | "pet" | "care" | "chat" | "quest";

export type CompanionMoodId =
  | "cozy"
  | "sleepy"
  | "sparkly"
  | "brave"
  | "calm"
  | "curious";

export type CompanionBondRecord = {
  userId: string;
  affinity: number;
  moodId: CompanionMoodId;
  moodDate: string;
  lastVisitDate: string;
  visitStreak: number;
  totalPets: number;
  totalCares: number;
  /** YYYY-MM-DD → pet count today */
  petsToday: number;
  petsDate: string;
  /** YYYY-MM-DD → chat count today */
  chatsToday: number;
  chatsDate: string;
  /** care types already done on careDate */
  caresDone: CareType[];
  careDate: string;
  /** quest ids that already granted bond today */
  questBonusIds: string[];
  questBonusDate: string;
  updatedAt: string;
};

export type CompanionBondView = {
  affinity: number;
  affinityLabel: string;
  moodId: CompanionMoodId;
  moodLabel: string;
  /** The same mood in the friend's own voice: "나 오늘은 포근해." */
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
