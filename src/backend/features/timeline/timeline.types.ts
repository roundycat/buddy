/**
 * Backend interfaces for the Timeline domain.
 * Covers medication logs and daily challenges for hospitalized adolescents.
 */

export type MedicationStatus = "taken" | "scheduled" | "missed";

export interface MedicationEntry {
  id: string;
  name: string;
  dosage: string;
  scheduledAt: string;
  status: MedicationStatus;
  notes?: string;
}

export type ChallengeStatus = "pending" | "in_progress" | "completed";

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  status: ChallengeStatus;
  category: "movement" | "reflection" | "connection" | "rest";
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: "medication" | "challenge" | "note";
  title: string;
  summary: string;
}

export interface GetTimelineResponse {
  medications: MedicationEntry[];
  challenges: DailyChallenge[];
  events: TimelineEvent[];
}
