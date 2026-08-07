# Migration Report — Amazon Bedrock

**Date:** 2026-08-06  
**Status:** Complete

## Before

Rule-based `MockLlmProvider` / optional OpenAI-compat paths.

## After

| Layer | Module |
|-------|--------|
| Provider | `shared/llm/providers/bedrock.provider.ts` (Converse, stream, tools) |
| Orchestrator | `ai/orchestrator.ts` → `llm-gateway.ts` |
| Guardrails | `BEDROCK_GUARDRAIL_ID` / `VERSION` on Converse |
| Models | Chat/analysis Haiku · quality Opus (`BEDROCK_MODEL_ID_*`) |
| Images | Stability `InvokeModel` in persona avatar pipeline (not via Controllers) |

## Rule

**Controllers never import Bedrock.**  
Feature services call `@/backend/ai/orchestrator` only.

## Env

```
LLM_PROVIDER=bedrock
LLM_FALLBACK_TO_MOCK=true   # local safety net
BEDROCK_MODEL_ID_CHAT=...
BEDROCK_MODEL_ID_QUALITY=...
BEDROCK_GUARDRAIL_ID=...
BEDROCK_GUARDRAIL_VERSION=1
```

## Verify

`GET /api/health` → `llm.provider === "bedrock"` when configured.

## UX

Streaming chat, missions, garden seeds, storybook — same screens.
