/**
 * Today's Small Adventure — 3 gentle, personalized quests per day.
 */

export type AdventureScene = "sunny" | "rainy" | "treatment" | "low_energy";

export type AdventureQuestStatus = "available" | "done";

/** How the child completes the quest inside the app. */
export type AdventureQuestKind =
  | "photo"
  | "garden"
  | "chat"
  | "post"
  | "observe";

export interface AdventureQuestProgress {
  completedAt?: string;
  photoId?: string;
  note?: string;
}

export interface AdventureContextFactors {
  weather: {
    code: "sunny" | "rainy" | "cloudy";
    label: string;
    emoji: string;
  };
  ward: {
    outdoorOk: boolean;
    label: string;
  };
  mood: {
    id: string | null;
    label: string;
    emoji: string;
  };
  age: number | null;
  interests: string[];
  schedule: {
    hasTreatment: boolean;
    labels: string[];
  };
  energy: string | null;
  memory: {
    turnCount: number;
    emotionalThemes: string[];
    toneHint: string | null;
  };
  guardian: {
    linked: boolean;
    count: number;
  };
}

export interface AdventureQuestItem {
  id: string;
  emoji: string;
  title: string;
  hint: string;
  points: number;
  kind: AdventureQuestKind;
  /** Deep link into the app activity */
  actionHref: string;
  status: AdventureQuestStatus;
  progress: AdventureQuestProgress;
  /** True when activity evidence exists and claim is allowed */
  readyToClaim: boolean;
}

export interface AdventureQuestResponse {
  scene: AdventureScene;
  headline: string;
  dateLabel: string;
  companionNote: string;
  /** Why these quests were chosen (kid-friendly chips) */
  factors: Array<{ emoji: string; label: string }>;
  context: AdventureContextFactors;
  quests: AdventureQuestItem[];
  /** Set when all missions done — AI day story */
  dayStory: AdventureDayStory | null;
  completedCount: number;
  allComplete: boolean;
}

export interface AdventureDayStory {
  narrative: string;
  createdAt: string;
  memoryEventId: string;
}

export interface AdventureDayPackQuest {
  id: string;
  emoji: string;
  title: string;
  hint: string;
  points: number;
  kind: AdventureQuestKind;
  progress?: AdventureQuestProgress;
}

export interface AdventureDayPack {
  userId: string;
  date: string;
  scene: AdventureScene;
  headline: string;
  companionNote: string;
  factors: Array<{ emoji: string; label: string }>;
  context: AdventureContextFactors;
  quests: AdventureDayPackQuest[];
  generatedBy: "rules" | "llm";
  dayStory?: AdventureDayStory;
}
