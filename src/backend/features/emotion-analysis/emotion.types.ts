/**
 * Structured emotion analysis from child↔companion dialogue.
 * Non-clinical — for companion memory, parent summaries, growth journal.
 */

export interface EmotionAnalysisRecord {
  id: string;
  userId: string;
  /** chat turn, garden plant, etc. */
  source: "chat" | "garden" | "quest";
  sourceRef?: string;
  /** Primary emotion label in Korean (e.g. 불안, 안도) */
  primaryEmotion: string;
  keywords: string[];
  /** Valence / intensity 0–100 (higher = warmer / more settled) */
  emotionScore: number;
  /** Model confidence 0–1 */
  confidence: number;
  /** Short non-diagnostic summary — never raw chat */
  summary: string;
  dateKey: string;
  createdAt: string;
}

export interface EmotionDayAggregate {
  dateKey: string;
  primaryEmotion: string;
  keywords: string[];
  averageScore: number;
  averageConfidence: number;
  sampleCount: number;
}
