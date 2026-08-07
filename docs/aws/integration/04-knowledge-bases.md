# Migration Report — Knowledge Bases for Amazon Bedrock

**Date:** 2026-08-06  
**Status:** Complete

## Before

No durable retrieval for guardian Q&A / long-memory story compose.

## After

| Piece | Path |
|-------|------|
| Retrieve | `ai/kb/retrieve.ts` (`BedrockAgentRuntime` Retrieve) |
| Index (batch) | `ai/kb/index-summaries.ts` + `features/batch/kb-index.job.ts` |
| Objects | S3 `kb-summaries/{childUserId}/...` (Bridge-filtered text) |
| Consumers | Guardian RAG, growth storybook compose |

## Env

```
BEDROCK_KB_ID=...
AVATAR_S3_BUCKET=...   # summaries land next to other blobs
```

Provision script: `scripts/deploy/11-knowledge-base.ps1`

## Privacy

All indexed text passes **AI Bridge** `filterBridgeText` — no raw chat / GPS.

## UX

Parent report answers and storybook memory pulls stay the same UI; quality improves when KB is warm.
