# Remaining Technical Debt

**Project:** Beddy (Bedi)  
**Date:** 2026-08-06  
**Rule:** Debt is listed only if it is real in the current tree — not speculative rewrites.

---

## 1. P0 — production blockers

| ID | Debt | Why it matters | Suggested fix |
|----|------|----------------|---------------|
| D1 | ALB listener HTTP-only | Session cookies marked `secure` are useless / mixed content | ACM cert + HTTPS listener or CloudFront HTTPS-only origin |
| D2 | Weak/default session secrets possible | Account takeover | Enforce min entropy · Secrets Manager only · no code fallback in prod |
| D3 | Session HMAC compared with `!==` | Timing side channel | `crypto.timingSafeEqual` like cron |
| D4 | Demo passwords in repo + Dynamo seed | Public login if table is shared | Env-gated seed · rotate · separate demo account |

---

## 2. P1 — pilot blockers

| ID | Debt | Suggested fix |
|----|------|---------------|
| D5 | Dawn batch runs inside web task (fire-and-forget after 202) | SQS + worker task or Step Functions · at-least-once with per-job checkpoints |
| D6 | ALB health checks `/login` | Health check `/api/health` after adding DDB/S3/Bedrock probes |
| D7 | `07-observability.ps1` can overwrite Task IAM | Merge policies · single source of truth (CDK/Terraform later) |
| D8 | Invite codes via `Math.random` · no rate limit | `crypto.randomInt` · throttle by IP/guardian |
| D9 | Storybook compose bypasses Orchestrator observe/Guardrails | Call `runLlm` from orchestrator |
| D10 | Parent letter not consistently sealed into discharge tale · photo peek | Compose merge + auth rules for surprise |
| D11 | Dynamo no GSI for user-scoped lists | Add GSI `gsi1pk=USER#id`, `gsi1sk=MAP#ns#id` |
| D12 | S3 media shares CodeBuild bucket | Dedicated media bucket + SSE + lifecycle |
| D13 | `LLM_FALLBACK_TO_MOCK` often true | Force `false` in ECS task def |
| D14 | SNS alarm topic with no subscription | Subscribe ops email / Slack |

---

## 3. P2 — quality & scale

| ID | Debt | Notes |
|----|------|-------|
| D15 | Stream chat missing token/cost metrics | Extend observe on stream final message |
| D16 | Stability/Polly costs not in `AiCostUsd` | Separate `ImageCostUsd` / `TtsCostUsd` |
| D17 | Child APIs use `requireAuthUser` inconsistently | Standardize `requireChildUser` |
| D18 | Conversation SSE auth failure → 500 | Map UnauthorizedError to 401 before stream |
| D19 | Privacy filter is heuristic | Structured redaction + eval fixtures |
| D20 | Prompt injection eval suite absent | Golden attacks for companion + parent report |
| D21 | Focus trap missing on dialogs | Phase 4 leftover |
| D22 | Typography scale only partially applied | Migrate to `.type-*` with visual QA |
| D23 | Tablet still single column | Optional 2-col garden/wish later |
| D24 | `/api/health` public info leak | Auth or minimal `{ok:true}` |
| D25 | desiredCount=1 · no multi-AZ story | Scale after TLS + sticky session review |
| D26 | No IaC (scripts only) | CDK/Terraform when team grows |
| D27 | Duplicate store definitions risk (`memory-post`) | Audit single writer |
| D28 | `buildspec` container name vs task def drift risk | Align names in deploy script |
| D29 | Rate limit / WAF absent | CloudFront WAF for public URL |
| D30 | Dark mode / night ward theme absent | Design debt only |

---

## 4. Intentionally accepted (not debt)

| Choice | Rationale |
|--------|-----------|
| Middleware skips `/api` | Edge can’t easily verify HMAC; route guards are source of truth |
| JSON persistence locally | Developer mirror · not dual-write production |
| Image models outside Converse Guardrails | Different Bedrock API · prompt hygiene instead |
| Single-table design without GSI (today) | Simpler ops at demo scale |
| In-memory persona cache | Single-task demo · OK until multi-task |

---

## 5. Test debt

| Area | Status |
|------|--------|
| DomainError / withApiGuard unit tests | ✅ |
| Feature service integration tests | ❌ sparse |
| Playwright / e2e happy path | ❌ |
| Privacy filter fixtures | ❌ |
| Load test (chat + batch) | ❌ |

---

## 6. Documentation debt

| Item | Status |
|------|--------|
| Phase 1–4 reports | ✅ |
| aws-integration series | ✅ |
| This production pack | ✅ |
| Runbook for incident (Bedrock down / cron miss) | ⚠️ partial in checklists |
| Threat model (formal) | ❌ use Security Report as interim |

---

## 7. Suggested burn-down order

1. TLS + secrets + timing-safe session (D1–D3)  
2. Mock fallback off · SNS subscribe · health check (D6, D13, D14)  
3. Orchestrator storybook · invite entropy (D8–D9)  
4. Batch worker extraction (D5)  
5. GSI + media bucket (D11–D12)  
6. A11y focus trap + metrics gaps (D15, D21)  

Estimate for P0+P1 on a single engineer familiar with the repo: **2–4 focused days**, not a rewrite.
