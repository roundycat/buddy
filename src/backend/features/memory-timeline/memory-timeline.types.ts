/**
 * AI Memory Timeline — hospitalization journey events.
 */

export type MemoryEventType =
  | "admission"
  | "exam"
  | "surgery"
  | "rehab"
  | "friend"
  | "family"
  | "mood"
  | "adventure";

export interface MemoryEvent {
  id: string;
  type: MemoryEventType;
  title: string;
  summary: string;
  occurredAt: string;
  /** Optional link back to adventure day (YYYY-MM-DD) */
  adventureDate?: string;
}

export interface MemoryTimelineResponse {
  title: string;
  companionNote: string;
  events: MemoryEvent[];
}
