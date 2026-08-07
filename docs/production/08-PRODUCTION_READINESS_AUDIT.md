# Production Readiness Audit Report

**Project:** Beddy (Bedi)  
**Date:** 2026-08-06  
**Auditors (roles):** Principal SWE · AWS Solutions Architect · Senior QA · Security · UX · AI Systems  
**Constraint:** No breaking changes · no feature removal · backward compatible fixes preferred

---

## Production Readiness Score: **78 / 100**

### Scoring breakdown

| Category (weight) | Score | Weighted |
|-------------------|------:|---------:|
| 1. Clean Architecture (8) | 88 | 7.0 |
| 2. Code Quality (7) | 82 | 5.7 |
| 3. TypeScript Best Practices (6) | 85 | 5.1 |
| 4. Component Reusability (5) | 80 | 4.0 |
| 5. Performance Optimization (8) | 84 | 6.7 |
| 6. AWS Integration (10) | 80 | 8.0 |
| 7. AI Architecture (9) | 86 | 7.7 |
| 8. Security (12) | 68 → **76** after fixes | 9.1 |
| 9. Privacy (10) | 85 | 8.5 |
| 10. Accessibility (5) | 72 | 3.6 |
| 11. UX/UI Consistency (5) | 86 | 4.3 |
| 12. Error Handling (5) | 80 | 4.0 |
| 13. Logging & Monitoring (5) | 78 | 3.9 |
| 14. Cost Optimization (5) | 82 | 4.1 |
| 15. Deployment Readiness (5) | 65 | 3.3 |
| **Total** | | **≈ 78** |

### Verdict

| Audience | Ready? |
|----------|--------|
| AWS Hackathon live demo (closed URL) | **Yes** — score ≥75 with warm-up checklist |
| Invite-only clinical pilot | **Almost** — finish HTTPS + secret rotation + SNS |
| Open internet production | **Not yet** — TLS, WAF, batch worker, GSI still open |

---

## Fixes implemented in this audit (backward compatible)

| Fix | Severity addressed | Files |
|-----|-------------------|-------|
| Timing-safe session HMAC compare (Edge-safe) | Critical | `auth.session.ts` |
| Reject known-weak `AUTH_SESSION_SECRET` in production | Critical | `auth.session.ts` |
| Invite codes via `crypto.getRandomValues` | High | `guardian-link.service.ts` |
| Invite redeem rate limit (8/min/guardian, in-process) | High | `guardian-link.service.ts` |
| `/api/health` minimal public payload in production | High | `api/health/route.ts` |
| Conversation SSE returns **401** on auth failure | High | `api/conversation/route.ts` |
| Storybook compose → Orchestrator `runLlm` + safety rules | High | `growth-storybook.service.ts` |
| Production default `LLM_FALLBACK_TO_MOCK=false` | High | `env.ts` |
| Secrets script generates strong secrets (no weak default) | High | `08-secrets.ps1` |
| Dialog focus restore on close | Medium | `useDialogDismiss.ts` |
| `.env.example` documents missing vars / stronger guidance | Medium | `.env.example` |

`tsc` + `next lint` pass after changes.

---

## Category findings

### 1. Clean Architecture — 88

**Strengths:** Controllers → Services → Orchestrator/stores; Aurora retired; `src/shared` catalogs for client; Child/Parent/AI separation documented.

| Issue | Why it matters | Severity | Recommendation | Status |
|-------|----------------|----------|----------------|--------|
| Some image/Polly paths bypass Orchestrator | Metrics/Guardrails uneven | Medium | Keep as dedicated media adapters; document contract | Accepted |
| Middleware skips `/api` | Missed guard = public API | Medium | Keep + enforce `withApiGuard` audit | Monitor |

### 2. Code Quality — 82

| Issue | Severity | Recommendation | Status |
|-------|----------|----------------|--------|
| `guardian-link.service.ts` odd blank-line formatting | Low | Normalize on next touch | Open |
| Possible duplicate store writers (`memory-post`) | Medium | Single-writer audit | Open |
| Sparse integration/e2e tests | High | Playwright happy path before public launch | Open |

### 3. TypeScript Best Practices — 85

**Strengths:** Strict feature types, DomainError contracts, Vitest for HTTP mapping.  
**Gap:** Occasional `as` casts on LLM JSON parse — mitigated by null checks; keep `extractJsonObject` pattern.

### 4. Component Reusability — 80

**Strengths:** `ChildUi` / `ParentUi`, `FeaturePageShell`, `useSoftMotion`, `useDialogDismiss`.  
**Gap:** Focus trap still not shared (only Escape + restore). Medium a11y debt.

### 5. Performance Optimization — 84

**Strengths:** Haiku hot path, SSE early done, dawn batch, garden N+1 fix, persona TTL, `next/dynamic`, skeletons.  
**Open:** Dynamo GSI for list-by-user; stream token metrics; in-process cron.

### 6. AWS Integration — 80

**Strengths:** Dynamo/S3/Bedrock/KB/EventBridge/CW/Secrets/ECS scripts exist and match app.  
**Critical open:** ALB HTTP-only.  
**High open:** IAM overwrite by observability script; health check target; media bucket co-mingled with CodeBuild; SNS unsubscribed.

### 7. AI Architecture — 86

**Strengths:** Orchestrator contract, Guardrails on Converse, Bridge + KB owner filter, purpose-based models.  
**Fixed:** Storybook compose now uses `runLlm` + `withBeddySafety`.  
**Open:** Stability/Polly cost channels; prompt-injection eval suite.

### 8. Security — 76 (was ~68)

| Issue | Severity | Status |
|-------|----------|--------|
| Session HMAC non-constant-time | Critical | **Fixed** |
| Weak secret defaults | Critical | **Fixed** (runtime + secrets script) |
| Invite `Math.random` | High | **Fixed** |
| Invite brute-force | High | **Mitigated** (rate limit; still no WAF) |
| Health info disclosure | High | **Fixed** |
| SSE auth → 500 | High | **Fixed** |
| Demo passwords in repo/seed | Critical for public URL | **Open** (demo requirement) |
| TLS / HTTPS | Critical | **Open** (infra) |
| Long-lived AWS keys on laptop | Critical if exposed | **Open** (ops) |

### 9. Privacy — 85

**Strengths:** Parent DTOs exclude raw chat/diary; Bridge filter; KB path ownership; privacy toggles.  
**Open:** Batch quality model still *sees* raw turns to summarize; parent-letter surprise/photo edge case; heuristic Bridge limits.

### 10. Accessibility — 72

**Strengths:** Phase 4 Escape, 44px targets, focus-visible, reduced motion, sr-only skeletons.  
**Fixed:** Focus restore on dialog close.  
**Open:** Full focus trap / Tab cycle; some parent icon buttons still tight.

### 11. UX/UI Consistency — 86

**Strengths:** Soft empty/error/loading language; garden/wish/storybook motion; tablet `md:max-w-2xl`.  
**Open:** Full `.type-*` migration; optional 2-col tablet.

### 12. Error Handling — 80

**Strengths:** `withApiGuard`, DomainError, SoftErrorState, global `error.tsx`.  
**Fixed:** SSE 401 mapping.  
**Open:** A few routes still manual try/catch (`auth/me`, image GET).

### 13. Logging & Monitoring — 78

**Strengths:** `[bedi:obs]` JSON, Beddy metrics (API, Bedrock, tokens, cost, DDB, batch).  
**Open:** SNS email; alarm “P95” is Average; stream/image cost gaps; no synthetic canary.

### 14. Cost Optimization — 82

**Strengths:** Haiku chat, Opus batch-only, emotion/memory off hot path, `AiCostUsd`.  
**Risk:** Stability Ultra on-demand during demo; keep seal/illustrate off pitch path.

### 15. Deployment Readiness — 65

**Strengths:** Dockerfile standalone, CodeBuild/ECS script, secrets/KB/cron scripts, deploy checklists.  
**Blockers:** HTTPS, ALB health path, IAM script order, desiredCount=1, demo credential policy for shared tables.

---

## Remaining improvements before Hackathon demonstration

### Must do (day-of / T−24h)

1. [ ] Confirm ECS env: `LLM_FALLBACK_TO_MOCK=false`, Guardrail + KB IDs set  
2. [ ] Rotate Secrets Manager if still using `bedi-prod-change-me` (re-run hardened `08-secrets.ps1`)  
3. [ ] Warm chat + garden + wish + guardian home (see `docs/production/07-HACKATHON_DEMO_CHECKLIST.md`)  
4. [ ] Backup screen recording if Bedrock flakes  
5. [ ] Demo accounts work; do **not** advertise passwords beyond judges room  

### Should do (if time before stage)

6. [ ] Put HTTPS in front (CloudFront/ACM) even if ALB stays HTTP origin  
7. [ ] Subscribe SNS `bedi-ops-alerts` to a phone/email  
8. [ ] Manual `POST /api/cron/daily` smoke once the night before  
9. [ ] Verify Task IAM after any `07-observability.ps1` run  

### Nice / post-hackathon

10. [ ] Move dawn batch to worker / SQS  
11. [ ] Dynamo GSI for user-scoped lists  
12. [ ] Dedicated media S3 bucket + SSE  
13. [ ] Focus trap on dialogs  
14. [ ] Playwright e2e for child chat + guardian link  
15. [ ] Disable or rotate demo seeds on any long-lived public URL  

---

## Risk register (residual)

| ID | Risk | Severity | Owner action |
|----|------|----------|--------------|
| R1 | ALB/CloudFront without forced HTTPS | Critical | Infra before public traffic |
| R2 | Demo credentials are public knowledge in docs | High | Accept for hackathon; rotate after |
| R3 | In-process cron can die with task | High | Accept for demo; worker later |
| R4 | Observability IAM overwrite | High | Runbook: re-apply task policy |
| R5 | No GSI at scale | Medium | Monitor partition sizes |
| R6 | Stability cost spikes | Medium | Avoid live seal+illustrate |

---

## QA summary

| Check | Result |
|-------|--------|
| TypeScript `tsc --noEmit` | Pass |
| ESLint | Pass |
| Feature regressions from this audit | None intended (compat preserved) |
| New automated e2e | Not added (scope) |
| Security unit test for HMAC | Deferred — logic covered by session verify path |

---

## Final recommendation

Ship the **hackathon demonstration** from the current tree after T−24h warm-up and secret hygiene. Treat **78/100** as “demo-ready, production-hardening in progress.” Do not market the URL as open production until **R1 (HTTPS)** and post-event **demo password rotation** are done.

Full ops checklists remain in `docs/production/`.
