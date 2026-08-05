/**
 * Emotion Garden — grow feelings as flowers across the hospital stay.
 * Not a clinical mood log: plant one bloom per day → garden grows → storybook on discharge.
 */

export type MoodId = "happy" | "sad" | "sleepy" | "angry" | "love";

export interface MoodOption {
  id: MoodId;
  emoji: string;
  label: string;
}

export interface GardenFlower {
  id: string;
  mood: MoodId;
  emoji: string;
  /** Hospital day when planted (1-based) */
  dayIndex: number;
  plantedOn: string; // YYYY-MM-DD
  name: string;
  note: string;
}

export interface EmotionGardenAccount {
  userId: string;
  flowers: GardenFlower[];
  storybookSealed: boolean;
  sealedAt?: string;
}

export interface EmotionGardenResponse {
  title: string;
  companionNote: string;
  dayCount: number;
  todayDate: string;
  todayMood: MoodId | null;
  canPlantToday: boolean;
  moods: MoodOption[];
  flowers: GardenFlower[];
  /** Visual plot size grows with stay length + blooms */
  plotSlots: number;
  storybook: {
    sealed: boolean;
    title: string;
    summary: string;
    flowerCount: number;
    sealedAt?: string;
  };
}
