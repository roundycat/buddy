# Production Checklist

**Project:** Beddy (Bedi)  
**Date:** 2026-08-06  
**Purpose:** Gate for “we can put real families on this URL.”

Hackathon demo can ship with some items deferred — those are marked **DEMO-OK**. Items marked **MUST** block open production.

---

## 1. Architecture & code

| # | Item | Severity | Done |
|---|------|----------|------|
| 1.1 | Controllers do not call Bedrock SDK | MUST | [ ] |
| 1.2 | Feature LLM text via Orchestrator (except tracked debt) | MUST | [ ] |
| 1.3 | Aurora / `pg` absent | MUST | [ ] |
| 1.4 | Child / Parent / AI boundaries documented & enforced in services | MUST | [ ] |
| 1.5 | Storybook compose retargeted to Orchestrator | P1 | [ ] |
| 1.6 | `next build` green on release commit | MUST | [ ] |

---

## 2. Environment & secrets

| # | Item | Severity | Done |
|---|------|----------|------|
| 2.1 | `PERSISTENCE=dynamodb` | MUST | [ ] |
| 2.2 | `AUTH_PROVIDER=dynamodb` | MUST | [ ] |
| 2.3 | `LLM_PROVIDER=bedrock` | MUST | [ ] |
| 2.4 | `LLM_FALLBACK_TO_MOCK=false` | MUST | [ ] |
| 2.5 | `AUTH_SESSION_SECRET` strong · Secrets Manager only | MUST | [ ] |
| 2.6 | `CRON_SECRET` strong · matches EventBridge | MUST | [ ] |
| 2.7 | No AWS access keys on ECS task | MUST | [ ] |
| 2.8 | Laptop keys rotated if ever exposed | MUST | [ ] |
| 2.9 | `ALLOW_DEV_ROUTES` unset | MUST | [ ] |
| 2.10 | Guardrail + KB IDs set | MUST (pilot) | [ ] |
| 2.11 | `.env.example` matches required cloud vars | DEMO-OK | [ ] |

---

## 3. Network & deployment

| # | Item | Severity | Done |
|---|------|----------|------|
| 3.1 | HTTPS to users (ALB ACM or CloudFront) | MUST | [ ] |
| 3.2 | `NEXT_PUBLIC_APP_URL` matches public HTTPS URL | MUST | [ ] |
| 3.3 | ALB/target health on dependency-aware `/api/health` | P1 | [ ] |
| 3.4 | ECS desired ≥ 1 · restart policy OK | MUST | [ ] |
| 3.5 | Multi-AZ / desired ≥ 2 | P2 | [ ] |
| 3.6 | WAF rate limits | P2 | [ ] |
| 3.7 | Dockerfile non-root user | DEMO-OK (already) | [ ] |

---

## 4. Data stores

| # | Item | Severity | Done |
|---|------|----------|------|
| 4.1 | DynamoDB `BediApp` exists · PITR considered | MUST / P1 | [ ] |
| 4.2 | TTL enabled for coarse locations | DEMO-OK | [ ] |
| 4.3 | S3 media private · Block Public Access on | MUST | [ ] |
| 4.4 | Dedicated media bucket (not build bucket) | P1 | [ ] |
| 4.5 | SSE (AES-S3 or KMS) on media bucket | P1 | [ ] |
| 4.6 | GSI for user-scoped lists | P2 until scale | [ ] |
| 4.7 | Backup / export plan for child data | P1 clinical | [ ] |

---

## 5. Security & privacy

| # | Item | Severity | Done |
|---|------|----------|------|
| 5.1 | Session HMAC timing-safe compare | MUST | [ ] |
| 5.2 | Demo seed disabled or passwords rotated for public URL | MUST | [ ] |
| 5.3 | Invite code crypto + rate limit | P1 | [ ] |
| 5.4 | Parent never receives raw chat / diary in API responses | MUST | [ ] |
| 5.5 | Bridge filter on KB index + RAG hits | MUST | [ ] |
| 5.6 | Parent letter surprise / photo rules reviewed | P1 | [ ] |
| 5.7 | `/api/health` minimized or authenticated | P1 | [ ] |
| 5.8 | Privacy policy / consent copy for guardians | MUST clinical | [ ] |
| 5.9 | Bedrock / log retention reviewed for PHI-like data | MUST clinical | [ ] |

---

## 6. AI & cost

| # | Item | Severity | Done |
|---|------|----------|------|
| 6.1 | Chat model = Haiku (or approved fast profile) | MUST | [ ] |
| 6.2 | Quality model only on batch / parent compose | MUST | [ ] |
| 6.3 | Guardrails attached on Converse | MUST | [ ] |
| 6.4 | CloudWatch `AiCostUsd` + alarms reviewed | P1 | [ ] |
| 6.5 | Stability usage budget / manual gate for demos | DEMO-OK | [ ] |
| 6.6 | Stream token metrics | P2 | [ ] |

---

## 7. Batch & jobs

| # | Item | Severity | Done |
|---|------|----------|------|
| 7.1 | EventBridge rule enabled · correct URL | MUST | [ ] |
| 7.2 | Manual cron smoke → 202 + logs | MUST | [ ] |
| 7.3 | FailedInvocations alarm + SNS subscriber | MUST | [ ] |
| 7.4 | Batch moved off web task | P1 | [ ] |
| 7.5 | Per-job checkpoint / resume | P2 | [ ] |

---

## 8. Observability

| # | Item | Severity | Done |
|---|------|----------|------|
| 8.1 | `Beddy` metrics flowing | MUST | [ ] |
| 8.2 | Dashboard bookmarked | DEMO-OK | [ ] |
| 8.3 | LLM error + latency alarms | MUST | [ ] |
| 8.4 | SNS subscription confirmed | MUST | [ ] |
| 8.5 | Runbook: Bedrock outage / cron miss / Dynamo throttle | P1 | [ ] |

---

## 9. UX / a11y / client

| # | Item | Severity | Done |
|---|------|----------|------|
| 9.1 | Loading / empty / error states present | DEMO-OK (Phase 4) | [ ] |
| 9.2 | Escape closes dialogs | DEMO-OK | [ ] |
| 9.3 | Focus trap | P2 | [ ] |
| 9.4 | `prefers-reduced-motion` honored | DEMO-OK | [ ] |
| 9.5 | Tablet + phone smoke | MUST | [ ] |

---

## 10. Legal / clinical (if real patients)

| # | Item | Done |
|---|------|------|
| 10.1 | Hospital / IRB / parental consent path | [ ] |
| 10.2 | Data processing agreement with AWS region choice | [ ] |
| 10.3 | Crisis escalation copy reviewed by clinician | [ ] |
| 10.4 | Account deletion path tested (`delete-account`) | [ ] |
| 10.5 | No medical claims in marketing copy | [ ] |

---

## 11. Sign-off

| Role | Name | Date | Go / No-Go |
|------|------|------|------------|
| Engineering | | | |
| Design / UX | | | |
| Security review | | | |
| Product / demo owner | | | |

**Minimum for open production:** all MUST rows checked.  
**Minimum for hackathon URL:** MUST network/secrets/AI rows that protect demos + DEMO-OK UX; document deferred P1s in the pitch Q&A.
