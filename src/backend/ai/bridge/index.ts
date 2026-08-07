import "server-only";

/**
 * AI Bridge — Child → Parent information crossing.
 *
 * Only summaries may cross. Raw chat transcripts and precise coordinates
 * are stripped here before Knowledge Base indexing or Guardian RAG.
 *
 * Controllers never call the Bridge; Parent/Child services and batch jobs do.
 */

export {
  filterBridgeText,
  filterBridgeHits,
  looksLikeRawChat,
  looksLikeCoordinates,
} from "@/backend/ai/bridge/privacy-filter";

export { retrieveGuardianContext } from "@/backend/ai/rag/guardian-rag";
