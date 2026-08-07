# Final Architecture Report

**Project:** Beddy (Bedi)  
**Phase:** 5 — Production Readiness  
**Date:** 2026-08-06  
**Status:** Feature-complete · AWS-integrated · UX polished · ready for gated production launch

---

## 1. What Beddy is

Beddy is a hospital companion for children and a quiet summary surface for guardians.

- **Child** talks to a secret friend, plants emotions, hangs wishes, completes small adventures, and grows a storybook toward discharge.
- **Parent** sees curated summaries, empathy guides, and schedules — never raw chat or private diaries.
- **AI** sits behind an Orchestrator and a privacy Bridge. Controllers never call Bedrock.

---

## 2. System layers

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js App Router (UI + API Controllers)                  │
│  middleware: page auth · /api left to route guards          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Feature Services (business logic)                          │
│  conversation · garden · wish · adventure · storybook       │
│  parent · diary · photos · hospital · wallet · batch        │
└─────────────┬────────────────────────────┬──────────────────┘
              │                            │
┌─────────────▼────────────┐  ┌────────────▼──────────────────┐
│  AI Orchestrator         │  │  Persistence                  │
│  runLlm / stream / tools │  │  createMapStore → DynamoDB    │
│  agent-run · Bridge/RAG  │  │  createBlobStore → S3         │
│  → Bedrock / Polly       │  │  auth repo → USER# / EMAIL#   │
└──────────────────────────┘  └───────────────────────────────┘
```

| Layer | Path | Rule |
|-------|------|------|
| Frontend | `src/frontend/**` | Client-safe catalogs from `src/shared/**`; no `@/backend` in `"use client"` |
| Controllers | `src/app/api/**` | Thin; `withApiGuard` + `requireAuth*` |
| Services | `src/backend/features/**` | All business logic |
| AI | `src/backend/ai/**` | Orchestrator is the only Converse entry for services |
| Shared | `src/backend/shared/**` · `src/shared/**` | HTTP, persist, observability, catalogs |

---

## 3. Child / Parent / AI separation

| Concern | Child | Parent | AI |
|---------|-------|--------|-----|
| Auth role | `child` | `guardian` | — |
| Page space | `/`, `/garden`, `/wish`, … | `/guardian/*` | — |
| Data seen | Own stores only | Linked child **summaries** | Prompt context + KB docs |
| Chat | Full history (80 turns) | **Never** | Hot path: Haiku stream |
| Diary / raw emotion notes | Own | Blocked by design | Batch refine only |
| Cross-role | Invite code | Link + privacy toggles | Bridge filter + KB owner path |

---

## 4. AI architecture

```
Feature Service
    → @/backend/ai/orchestrator
        → llm-gateway (purpose → model, Guardrails, observeAsync)
            → bedrock.provider (Converse / stream / tools)
    → @/backend/ai/bridge (filterBridgeText / retrieveGuardianContext)
    → agent-run (budgeted pipelines for adventure agent / RAG timing)
```

| Purpose | Model env | Typical use |
|---------|-----------|-------------|
| `chat` / `analysis` | `BEDROCK_MODEL_ID_CHAT` (Haiku) | Companion stream, light analysis |
| `quality` | `BEDROCK_MODEL_ID_QUALITY` (Opus) | Batch memory, parent compose, stories |

**Known exceptions (not via Orchestrator Converse):**

- Stability image: avatar, schedule comic, storybook illustration (`InvokeModel`)
- Polly: storybook narration
- `growth-storybook.service` compose path still calls `getLlmProvider().chat()` directly in one place — should be retargeted to Orchestrator before hard production (see Technical Debt)

---

## 5. Data model (logical)

Single DynamoDB table `BediApp` (`pk` + `sk`):

| Family | Example pk / sk |
|--------|-----------------|
| Map stores | `MAP#personas` / `{userId}` |
| Auth | `USER#{id}` / `PROFILE`, `EMAIL#{email}` / `UNIQUE` |
| Batch lock | `BATCH#daily` / `{YYYY-MM-DD}` |

Blobs on S3 (when `AVATAR_S3_BUCKET` set): `avatars/`, `photos/`, `diary/`, `schedule-images/`, `storybooks/`, `storybook-parent-letters/`, `kb-summaries/`.

---

## 6. Runtime flows

### Hot path — child chat

```
POST /api/conversation (SSE)
  → requireAuth → parallel child context
  → Guardrail + Haiku stream
  → SSE done (input unlocks)
  → void: persist turn + heuristic memory/emotion
```

### Dawn batch — EventBridge

```
05:00 KST → POST /api/cron/daily (x-bedi-cron-secret)
  → 202 Accepted → in-process runDailyBatch
  → memory → emotion → stories → missions → parent → kbIndex
  → concurrency 3 per phase
```

### Parent report

```
Guardian question
  → linked child summaries + privacy toggles
  → Bridge filter + KB retrieve (owner-scoped)
  → quality model compose
  → citations without raw chat
```

---

## 7. Frontend architecture

- App Router pages load data via `src/app/_server/loaders.ts`
- Heavy views: `next/dynamic` + `SoftSkeleton` fallbacks
- Child UI kit: `ChildUi` (skeleton / empty / error) · Parent kit: `ParentUi`
- Motion: Framer + `MotionConfig reducedMotion="user"` · CSS garden/tree ambience
- Shells: `FeaturePageShell` / `ParentShell` — `max-w-lg` phone, `md:max-w-2xl` tablet

---

## 8. Environment modes

| Mode | Persistence | Auth | LLM |
|------|-------------|------|-----|
| Local default | `json` (`.data`) | dynamodb or mock | bedrock or mock |
| Cloud / ECS | `dynamodb` | `dynamodb` | `bedrock` |

JSON is a **developer mirror** of the same store interface — not a second production DB.

---

## 9. Quality gates already in place

| Gate | Evidence |
|------|----------|
| Architecture refactor Phases 1–4 | `docs/REFACTORING_REPORT_PHASE*.md` |
| AWS integration | `docs/aws/integration/*` |
| Performance | `docs/PERFORMANCE_REPORT_PHASE3.md` |
| UX polish | `docs/UX_IMPROVEMENT_REPORT_PHASE4.md` |
| Build | `next build` 34 routes (2026-08-06) |
| Unit tests | Vitest: `DomainError`, `withApiGuard` contracts |

---

## 10. Verdict

The architecture is **production-shaped**: clear layers, DynamoDB/S3/Bedrock/EventBridge/CloudWatch wired, Child/Parent/AI boundaries enforced in services and Bridge.

It is **not yet production-hardened** on transport (TLS), batch reliability (in-process fire-and-forget), IAM script ordering, and a short list of security items. Those are tracked in the Security Report, Technical Debt, and Production Checklist — not architecture redesign.
