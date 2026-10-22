/**
 * Frontend-facing API contracts.
 * These mirror backend response shapes but live in the frontend space
 * so UI code never depends on backend modules.
 */

export interface PersonaDto {
  id: string;
  name: string;
  role: string;
  greeting: string;
  tone: string;
  companionMessage: string;
  prompt?: string;
  dayCount?: number;
  callName?: string;
  energy?: "low" | "medium" | "high";
  interaction?: "listen" | "chat" | "motivate" | "play" | "quiet";
  characterSheet?: string;
  buildMode?: "mirror" | "custom";
  self?: {
    nickname: string;
    ageOrBirthYear: string;
    region: string;
    disposition: string;
    mbti: string;
    strengthsWeaknesses: string;
    stressRelief: string;
    hobbies: string;
    favoriteHobby: string;
    mainActivity: string;
    favoriteFood: string;
  };
  profile?: {
    nickname: string;
    ageOrBirthYear: string;
    region: string;
    disposition: string;
    mbti: string;
    strengthsWeaknesses: string;
    stressRelief: string;
    hobbies: string;
    favoriteHobby: string;
    mainActivity: string;
    favoriteFood: string;
  };
}

export interface PersonaApiResponse {
  persona: PersonaDto;
  setupCompleted?: boolean;
}

export type MedicationStatusDto = "taken" | "scheduled" | "missed";

export interface MedicationDto {
  id: string;
  name: string;
  dosage: string;
  scheduledAt: string;
  status: MedicationStatusDto;
  notes?: string;
}

export interface TimelineEventDto {
  id: string;
  timestamp: string;
  type: "medication" | "challenge" | "note";
  title: string;
  summary: string;
}

export interface TimelineApiResponse {
  medications: MedicationDto[];
  challenges: Array<{
    id: string;
    title: string;
    description: string;
    status: "pending" | "in_progress" | "completed";
    category: "movement" | "reflection" | "connection" | "rest";
  }>;
  events: TimelineEventDto[];
}

export type ConversationRoleDto = "user" | "assistant";

export interface ConversationMessageDto {
  id: string;
  role: ConversationRoleDto;
  content: string;
  createdAt: string;
  meta?: {
    provider?: string;
    model?: string;
  };
}

export interface ConversationCrisisActionDto {
  id: string;
  label: string;
  href?: string;
  hint: string;
}

export interface ConversationCrisisDto {
  /** urgent | elevated | protect */
  level: string;
  empathyHint: string;
  /** One line telling the child who to talk to (server copy, level-aware) */
  guidance?: string;
  /** What was shared and with whom — never a secret from the child */
  transparency?: string;
  actions: ConversationCrisisActionDto[];
}

export interface ConversationApiResponse {
  reply: ConversationMessageDto;
  crisis?: ConversationCrisisDto;
}

export interface ConversationHistoryApiResponse {
  messages: ConversationMessageDto[];
  memory?: {
    turnCount: number;
    speechStyleNotes: string;
    emotionalThemes: string[];
    importantFacts: string[];
    preferredToneNotes: string[];
  };
}

export type HospitalItemTypeDto =
  | "exam"
  | "treatment"
  | "play"
  | "quiz"
  | "story"
  | "cheer";

export interface HospitalDayItemDto {
  id: string;
  type: HospitalItemTypeDto;
  title: string;
  childTitle?: string;
  time?: string;
  explanation: string;
  whatText?: string;
  whyText?: string;
  notifyText?: string;
  imageUrl?: string;
  imageStatus?: "pending" | "ready" | "failed";
  done?: boolean;
  source?: "parent" | "system";
  dateKey?: string;
}


export interface HospitalDayApiResponse {
  dateLabel: string;
  companionNote: string;
  items: HospitalDayItemDto[];
  parentItemCount?: number;
  freshDeliveries?: Array<{
    id: string;
    type: HospitalItemTypeDto;
    title: string;
    childTitle?: string;
    time?: string;
    notifyText?: string;
    whatText?: string;
  }>;
}

export type MemoryEventTypeDto =
  | "admission"
  | "exam"
  | "surgery"
  | "rehab"
  | "friend"
  | "family"
  | "mood"
  | "adventure";

export interface MemoryEventDto {
  id: string;
  type: MemoryEventTypeDto;
  title: string;
  summary: string;
  occurredAt: string;
}

export interface MemoryTimelineApiResponse {
  title: string;
  companionNote: string;
  events: MemoryEventDto[];
}

export interface MoodPointDto {
  date: string;
  label: string;
  level: number;
}

export interface GrowthMomentDto {
  id: string;
  kind: "courage" | "joy" | "adaptation" | "mood";
  title: string;
  note: string;
  date: string;
}

export interface GrowthJournalApiResponse {
  companionNote: string;
  moodSeries: MoodPointDto[];
  moments: GrowthMomentDto[];
}
