import "server-only";
import {
  formatCompanionCharacterForPrompt,
  formatSelfForPrompt,
  getPersonaForUser,
} from "@/backend/features/persona/persona.store";
import {
  formatMemoryForPrompt,
  getConversationHistory,
  getConversationMemory,
} from "@/backend/features/conversation/conversation.store";
import { formatWishesForPrompt } from "@/backend/features/wish-tree/wish-tree.service";
import type { CompanionPromptContext } from "@/backend/ai/prompts/companion";
import type { ConversationMessage } from "@/backend/features/conversation/conversation.types";
import type { ConversationMemory } from "@/backend/features/conversation/memory.types";
import type { Persona } from "@/backend/features/persona/persona.types";

/**
 * ChildContextService — aggregates companion context for one child.
 * Parallelizes store reads that used to be sequential awaits.
 */
export interface ChildCompanionContext {
  persona: Persona | undefined;
  hasPersona: boolean;
  characterSheet: string;
  selfSummary: string;
  profileSummary: string;
  storedHistory: ConversationMessage[];
  memory: ConversationMemory | undefined;
  companion: CompanionPromptContext;
}

export async function resolveChildCompanionContext(
  userId?: string,
  currentMessage?: string
): Promise<ChildCompanionContext> {
  if (!userId) {
    return emptyContext();
  }

  const [persona, storedHistory, memory, wishSummary] = await Promise.all([
    getPersonaForUser(userId),
    getConversationHistory(userId),
    getConversationMemory(userId),
    formatWishesForPrompt(userId),
  ]);

  const hasPersona = Boolean(persona?.setupCompleted && persona.profile);
  const characterSheet = formatCompanionCharacterForPrompt(persona);
  const selfSummary = formatSelfForPrompt(persona?.self);
  const profileSummary = [characterSheet, selfSummary].join("\n\n");

  return {
    persona,
    hasPersona,
    characterSheet,
    selfSummary,
    profileSummary,
    storedHistory,
    memory,
    companion: {
      name: persona?.name,
      tone: persona?.tone,
      callName: persona?.callName || "너",
      childName: persona?.self?.nickname,
      styleKey: persona?.interaction,
      energyKey: persona?.energy,
      companionVoice: persona?.companionMessage,
      characterSheet,
      selfSummary,
      memorySummary: memory
        ? formatMemoryForPrompt(memory, currentMessage)
        : undefined,
      wishSummary,
      hasPersona,
    },
  };
}

function emptyContext(): ChildCompanionContext {
  return {
    persona: undefined,
    hasPersona: false,
    characterSheet: "",
    selfSummary: "",
    profileSummary: "",
    storedHistory: [],
    memory: undefined,
    companion: {
      callName: "너",
      hasPersona: false,
    },
  };
}
