/**
 * Emotion & growth journal — non-clinical emotional progress.
 */

export interface MoodPoint {
  date: string;
  label: string;
  level: number; // 1-5
}

export interface GrowthMoment {
  id: string;
  kind: "courage" | "joy" | "adaptation" | "mood";
  title: string;
  note: string;
  date: string;
}

export interface GrowthJournalResponse {
  companionNote: string;
  moodSeries: MoodPoint[];
  moments: GrowthMoment[];
}
