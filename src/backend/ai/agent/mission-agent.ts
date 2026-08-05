/**
 * AI Agent — Today's Mission.
 * plan(LLM) → conditional tool call → generate(LLM) → validate(pure) → repair(LLM, max 1) → rule fallback
 * This is the only true Agent in the system. The guardian path is RAG, not an Agent.
 */
export { prepareAdventurePackForDate } from "@/backend/features/adventure-quest/adventure-quest.service";
export { runMissionAgent } from "@/backend/features/adventure-quest/adventure-quest.agent";
