# Migration Report — AI Orchestrator & AI Bridge

**Date:** 2026-08-06  
**Status:** Complete

## Separation of responsibilities

| Lane | Owns | Must not |
|------|------|----------|
| **Child** | Conversation, garden, wish, adventure, diary, bond | Call Bedrock from routes; read Parent private settings |
| **Parent** | Home, schedule, report, empathy, letter | Read raw child chat transcripts |
| **AI** | Orchestrator, Bridge, KB, prompts, agents | Own HTTP Controllers |

## AI Orchestrator

**Module:** `src/backend/ai/orchestrator.ts`

Exports used by feature services:

- `runLlm` / `runLlmWithTools` / `streamCompanionChat` / `companionChat`
- `runPipeline` (agent / RAG budgets + traces)
- `observeBatchRun` / `observeKbSearch`
- model purpose routing + Guardrails (via gateway)

Controllers import **zero** Orchestrator symbols.

## AI Bridge

**Module:** `src/backend/ai/bridge/index.ts`

- `filterBridgeText` / `filterBridgeHits` — strip raw chat & coordinates
- `retrieveGuardianContext` — Parent-facing RAG over KB summaries

Child private dialogue stays in Child stores; only Bridge-safe summaries reach Parent AI.

## Call path example

```
POST /api/conversation
  → conversation.service
  → orchestrator.streamCompanionChat
  → Bedrock provider

POST /api/parent/report
  → parent.service
  → bridge.retrieveGuardianContext
  → orchestrator.runLlm (Opus quality)
```
