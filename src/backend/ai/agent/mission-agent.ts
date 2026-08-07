/**
 * AI Agent — Today's Mission.
 * plan via Bedrock Converse tool use — the model reads the tool catalogue
 * (emotional guidance / recent quest titles) and decides what to call, then
 * submits a plan → generate(LLM) → validate(pure) → repair(LLM, max 1) → rule fallback.
 * This is the only true Agent in the system. The guardian path is RAG, not an Agent.
 */
export { prepareAdventurePackForDate } from "@/backend/features/adventure-quest/adventure-quest.service";
export { runMissionAgent, validatePack } from "@/backend/features/adventure-quest/adventure-quest.agent";
export { lookupEmotionalGuidance } from "@/backend/ai/agent/guidance/lookup-emotional-guidance";
