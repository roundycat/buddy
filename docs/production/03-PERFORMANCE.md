# Performance Report (Production Readiness)

**Project:** Beddy (Bedi)  
**Date:** 2026-08-06  
**Builds on:** Phase 3 Performance Report · Phase 4 UX polish (perceived performance)

---

## 1. Executive summary

Hot-path chat is designed for **one Bedrock Converse stream** with early SSE `done`. Heavy AI work (memory, emotion refine, stories, parent prep, KB index) runs on the **dawn EventBridge batch**. Dynamo hot paths avoid classic N+1 in the garden; persona reads use a short TTL cache. Frontend major views are code-split; Phase 4 replaced blank “loading…” text with skeletons so waiting feels intentional.

Remaining scale limits: **no Dynamo GSI**, **in-process cron**, **image generation cost/latency**, **stream token metrics gap**.

---

## 2. Latency — API & AI

| Path | Behavior | Observability |
|------|----------|---------------|
| Child chat SSE | Stream → early `done` → async persist | `BedrockFirstTokenMs`, `BedrockLatencyMs`, `ApiLatencyMs` |
| Parent home / report | Cached prep when batch warm; quality model on miss | `RagLatencyMs`, `AiCostUsd` |
| Garden / wish / adventure GET | Dynamo map reads · parallel where coded | `DynamoLatencyMs`, `ApiLatencyMs` |
| Storybook compose | Synchronous LLM + later on-demand art/TTS | High variance · cost-heavy |
| Dawn batch | Accepted 202 · runs up to `maxDuration` | `BatchLatencyMs` per job |

Historical STEP 1 bench (local, 2026-08-05): first token Opus **2139 ms** → Haiku **1413 ms** (−34%). Re-measure with `scripts/bench-step1.mjs` before demos.

---

## 3. Bedrock call reduction

| Before | After |
|--------|--------|
| Chat + emotion LLM every turn | Chat only · emotion heuristic on turn |
| Emotion LLM × turns/day | ≤1 nightly refine / child |
| Day story on page load | Precomposed in `story-update.job` when missions done |
| Memory extraction per turn | Heuristic learn · quality consolidate at dawn |

Still on hot path (by design): companion chat, wish inspiration, garden seed suggestion, adventure agent when needed, parent compose on cache miss, storybook seal/illustration/narration when user triggers them.

---

## 4. DynamoDB access patterns

| Hot path | Optimization |
|----------|--------------|
| Emotion garden blooms | One `listAdventurePacksForUser` → Map |
| Persona during multi-turn chat | 30s in-memory TTL |
| Child context | `Promise.all` fan-out |
| Dawn batch | `mapPool` concurrency 3 |

**Scale caveat:** photo/diary/schedule/invite lists Query the whole `MAP#*` partition then filter. Acceptable for demo; add GSI(`userId`) before thousands of items per namespace.

---

## 5. Frontend performance

| Technique | Where |
|-----------|--------|
| `next/dynamic` | Home, garden, wish, adventure, storybook, onboarding |
| Image `loading=lazy` / `decoding=async` | Persona, waiting room, album, memory cards |
| Soft skeletons | Suspense / dynamic fallbacks (Phase 4) |
| Reduced motion | CSS + Framer `MotionConfig` |

Bundle snapshot after Phase 4 build (approx First Load JS): garden/wish ~158 kB, storybook ~160 kB, home ~124 kB — shared ~87 kB.

---

## 6. Caching

| Cache | Scope | TTL / notes |
|-------|-------|-------------|
| Persona memory | Process-local | 30s |
| Parent daily prep | Dynamo `parent-daily-prep` | Dawn-written |
| Browser | S3 `Cache-Control: private, max-age=120` on blobs | Short |

No Redis/CloudFront cache layer for API JSON yet.

---

## 7. Monitoring coverage

| Signal | Covered? |
|--------|----------|
| API latency / errors | ✅ `withApiGuard` |
| Bedrock latency / errors | ✅ |
| Token + estimated USD | ✅ non-stream observeAsync |
| Stream token usage | ❌ gap |
| Dynamo latency | ✅ |
| KB / agent / RAG | ✅ |
| Cron failures | ✅ EventBridge FailedInvocations |
| S3 read errors as named metric | ⚠️ write errors yes · dashboard may show unused read metric |
| End-to-end synthetic probe | ❌ not scripted |

Alarms exist but SNS needs a human subscriber.

---

## 8. Responsiveness & perceived performance

| Concern | Status |
|---------|--------|
| Mobile shell | ✅ `max-w-lg` |
| Tablet | ✅ `md:max-w-2xl` (Phase 4) |
| Touch targets ≥44px | ✅ major CTAs / calendars / sheets |
| Loading / empty / error consistency | ✅ ChildUi |
| Long AI jobs blocking UI | Mostly async · compose/illustration still user-wait |

---

## 9. AI cost posture

Rough `ai-cost.ts` rates ($/1M tokens): Haiku 0.8/4 · Sonnet 3/15 · Opus 15/75.

| Driver | Control |
|--------|---------|
| Chat volume | Haiku + short context |
| Opus | Batch + parent compose only |
| Stability Ultra | On-demand illustration / avatars — **largest surprise bill risk** |
| Polly | Narration on demand |

Demo tip: avoid sealing + illustrating every storybook page during a timed pitch unless pre-warmed.

---

## 10. Error handling & resilience

| Layer | Behavior |
|-------|----------|
| API | `DomainError` / `HttpError` → stable status · `ApiErrors` metric |
| LLM | Optional mock fallback (disable in prod) |
| Cron | Idempotent daily claim · 202 before work |
| UI | SoftErrorState · global `error.tsx` |
| Storage | Local disk fallback if S3 unset (dev only) |

Failure mode to watch: mock fallback **silently** masks Bedrock outages when enabled.

---

## 11. Performance scorecard

| Area | Grade | Note |
|------|-------|------|
| Chat hot path | A− | Strong design · re-bench on prod region |
| Batch offload | A | Complete job set |
| Dynamo patterns | B+ | GSI for scale |
| Frontend load | A− | Code-split + skeletons |
| Cost observability | B | Stream gap · image cost not in AiCostUsd |
| Ops alarms | B− | Need SNS email + true p95 |
| Horizontal scale | C | desired=1 · in-process cron |

**Verdict:** Performance is **demo-ready and architecturally sound**. Next investments are GSI, worker-based batch, stream/image cost metrics, and TLS-terminated CDN caching if traffic grows.
