/**
 * Conversation memory — two layers (STEP 4).
 * Volatile: capped daily style/themes. Persistent: important facts with scores.
 */

export interface PersistentFact {
  text: string;
  /** 1–5 importance */
  importance: number;
  updatedAt: string;
}

export interface ConversationMemory {
  userId: string;
  /** How this user prefers to be spoken to (volatile) */
  speechStyleNotes: string;
  /** Observed emotional themes (volatile, capped) */
  emotionalThemes: string[];
  /**
   * Legacy string facts — kept for compat; prefer persistentFacts.
   * Batch consolidation migrates into persistentFacts.
   */
  importantFacts: string[];
  /** Persistent layer — no hard cap; ranked by importance */
  persistentFacts?: PersistentFact[];
  /** Tone / pacing preferences (volatile) */
  preferredToneNotes: string[];
  turnCount: number;
  updatedAt: string;
  /** Last nightly consolidation dateKey */
  lastConsolidatedDateKey?: string;
}

export function createEmptyMemory(userId: string): ConversationMemory {
  return {
    userId,
    speechStyleNotes: "",
    emotionalThemes: [],
    importantFacts: [],
    persistentFacts: [],
    preferredToneNotes: [],
    turnCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function allFactTexts(memory: ConversationMemory): string[] {
  const persistent = (memory.persistentFacts ?? []).map((f) => f.text);
  if (persistent.length) return persistent;
  return memory.importantFacts;
}
