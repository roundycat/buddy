# Phase 3 — Performance Optimization Report

**Project:** Beddy (Bedi)  
**Date:** 2026-08-06  
**Constraint:** UX unchanged · demo accounts preserved  

## Executive summary

Immediate chat path stays at **one Bedrock call**. Per-turn emotion LLM was removed (heuristic + nightly refine). Dawn EventBridge batch now runs **Memory / Emotion / Story / Mission / Parent / KB** with concurrency. CloudWatch gains **API latency**, **token counts**, and **AI cost estimates**. Garden Dynamo reads drop from N packs to **one list**. Heavy client views are **code-split** via `next/dynamic`.

---

## Changes by objective

### 1. API latency

| Change | Detail |
|--------|--------|
| `withApiGuard` metrics | `ApiLatencyMs`, `ApiInvocations`, `ApiErrors` |
| Chat | Already SSE/`done` before persist (STEP 1) |
| Context | `Promise.all` in `child-context.service` (unchanged) |

### 2. AI response time / immediate return

| Path | Behavior |
|------|----------|
| Conversation stream/sync | Reply first → `schedulePersistTurn` (void) |
| Persist | Heuristic memory + **heuristic emotion** (no Bedrock on turn) |

### 3. Reduce Bedrock calls

| Before | After |
|--------|--------|
| Chat + emotion LLM every turn | Chat only on turn |
| Emotion LLM × turns/day | **≤1** refine LLM / child / night (`emotion-refine.job`) |
| Day story on demand | Precomposed in **story-update.job** when missions done |

### 4. DynamoDB access

| Hot path | Fix |
|----------|-----|
| Emotion garden per-flower `getAdventurePack` | Single `listAdventurePacksForUser` → `Map<date, done>` |
| Chat persona re-read | 30s in-memory TTL cache on `getPersonaForUser` |

### 5. Promise.all / concurrency

| Area | Change |
|------|--------|
| Dawn batch | `mapPool(..., concurrency=3)` per child/guardian phase |
| Existing | Parent home / child context already fan-out with `Promise.all` |

### 6. Lazy loading

`next/dynamic` code-split (same UI, deferred JS):

- `/` WaitingRoom  
- `/garden` EmotionGardenView  
- `/adventure` AdventureQuestView  
- `/wish` WishTreeView  
- `/storybook` GrowthStorybookView  
- `/onboarding` OnboardingFlow  

### 7. Images

- Avatar/photo pipelines already use **sharp** where generated.  
- Full `next/image` migration deferred (layout-sensitive); code-split reduces main-bundle image UI cost.  
- Recommended follow-up: `next/image` on album + avatar with fixed sizes.

### 8. Caching

| Cache | TTL / scope |
|-------|-------------|
| Weather forecast | existing 45m |
| Persona | **new** 30s process cache |
| Parent daily prep | existing store (prefer prepared) |

### 9. EventBridge long-running AI

Cron `/api/cron/daily` batch order:

1. Memory Extraction (`memory-consolidate`)  
2. Emotion Analysis (`emotion-refine`)  
3. Story Updates (`story-update` → `maybeComposeDayStory`)  
4. Mission prep  
5. Parent Summary  
6. KB index  

---

## CloudWatch metrics (namespace `Beddy`)

| Domain | Latency | Errors / Invocations | Tokens | Cost |
|--------|---------|----------------------|--------|------|
| API | `ApiLatencyMs` | `ApiInvocations`, `ApiErrors` | — | — |
| Bedrock | `BedrockLatencyMs`, `BedrockFirstTokenMs` | `Invocations`, `Errors` | `InputTokens`, `OutputTokens` | `AiCostUsd` (estimate) |
| KB | `KbSearchLatencyMs` | via observe | when LLM used | via observe |
| Agent | `AgentLatencyMs`, `AgentStepLatencyMs` | counts | when LLM used | via observe |
| DynamoDB | `DynamoLatencyMs` | via observe | N/A | N/A |
| Batch | `BatchLatencyMs` | — | — | — |

Token/cost filled when Bedrock Converse returns `usage` (provider → `observeAsync`).

---

## Expected impact (directional)

| Metric | Direction |
|--------|-----------|
| Chat critical-path Bedrock calls | **−1 per turn** (emotion) |
| Nightly Bedrock (emotion) | **≤1 per active child** |
| Garden Dynamo Gets | **O(flowers) → O(1 list)** |
| Initial JS for heavy pages | Smaller main chunk (dynamic import) |
| Observability | API + token + cost visible in CW |

Re-measure chat with:

```bash
node --env-file=.env.local scripts/bench-step1.mjs
```

---

## Files touched (primary)

- `conversation` persist path / emotion hot path  
- `batch/{emotion-refine,story-update,run-daily-batch}.ts`  
- `shared/observability/*`, `shared/http/route.ts`, `shared/llm/*`  
- `emotion-garden.service.ts`, `persona.store.ts`  
- `app/{page,garden,adventure,wish,storybook,onboarding}/page.tsx`  
- `shared/async/map-pool.ts`

---

## Deferred (optional)

1. `next/image` on album/avatar surfaces  
2. Wallet ledger BatchGet for parent adventure done-flags  
3. Restore Mission Agent native tool-use loop (separate from this phase)  
4. Calibrate `AiCostUsd` rates to current AWS Bedrock price sheet  
