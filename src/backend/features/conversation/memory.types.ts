/**
 * Conversation memory — grows as the user chats with their persona.
 * Future: DynamoDB ConversationMemoryTable / vector store.
 */

export interface ConversationMemory {
  userId: string;
  /** How this user prefers to be spoken to */
  speechStyleNotes: string;
  /** Observed emotional themes */
  emotionalThemes: string[];
  /** Stable facts learned from chat */
  importantFacts: string[];
  /** Tone / pacing preferences */
  preferredToneNotes: string[];
  turnCount: number;
  updatedAt: string;
}

export function createEmptyMemory(userId: string): ConversationMemory {
  return {
    userId,
    speechStyleNotes: "",
    emotionalThemes: [],
    importantFacts: [],
    preferredToneNotes: [],
    turnCount: 0,
    updatedAt: new Date().toISOString(),
  };
}
