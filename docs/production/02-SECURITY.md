# Security Report

**Project:** Beddy (Bedi)  
**Date:** 2026-08-06  
**Scope:** Auth, API, Child/Parent privacy, AI prompts, secrets, IAM, transport

---

## 1. Executive summary

Beddy’s **privacy architecture is intentional**: parents receive Bridge-filtered summaries and KB docs, not raw chat or diaries. Most APIs use `withApiGuard` and role helpers. Gaps that block untrusted production are **transport (HTTP-only ALB)**, **secret hygiene**, **demo credential exposure**, **session HMAC timing**, and a few **API surface edges** (health, invite entropy, storybook letter preview).

Overall for hackathon / invite-only pilot: **acceptable with controls**.  
For open internet production: **fix P0s first**.

---

## 2. Authentication & sessions

| Control | Status |
|---------|--------|
| Signed cookie `bedi_session` (HMAC-SHA256) | ✅ |
| Role cookie for Edge routing | ✅ |
| `httpOnly` + `sameSite=lax` | ✅ |
| `secure` in production | ✅ (cookie) / ⚠️ ineffective if ALB is HTTP-only |
| Production blocks `AUTH_PROVIDER=mock` | ✅ |
| Timing-safe session signature compare | ❌ uses `!==` |
| Timing-safe cron secret | ✅ |
| Strong `AUTH_SESSION_SECRET` enforced | ⚠️ fallback exists for local |

**Middleware** (`middleware.ts`): protects page routes; **`/api/*` is deliberately bypassed**. API security depends entirely on per-route guards.

---

## 3. Authorization

| Pattern | Status |
|---------|--------|
| `requireGuardianUser` on parent APIs | ✅ |
| Linked-child scope for parent data | ✅ |
| `requireChildUser` on invite + strict storybook paths | ✅ |
| Many child features use `requireAuthUser` only | ⚠️ guardian session can call them under guardian’s own userId namespace (not another child’s) |
| KB retrieve owner path filter | ✅ |
| Parent privacy toggles (adventures / memory / emotion) | ✅ |

---

## 4. Child privacy

| Data | Child | Parent | Bedrock |
|------|-------|--------|---------|
| Raw chat turns | Stored (≤80) | **No** | Hot path: stream only · Batch: consolidate (prompt forbids quoting) |
| Picture diary | Own | **No** | Not in parent DTO |
| Emotion garden | Own | Trends (toggle) | Seed / refine |
| Wishes | Own | Aggregates | Inspiration |
| Adventure | Own | Summaries (toggle) | Agent / story |
| Coarse location | Rounded 1 decimal | Bridge blocks coords | Weather |

AI Bridge (`privacy-filter.ts`):

- Drops text that looks like raw chat transcripts or coordinates
- Caps length; Guardian RAG runs hits through the same filter

**Residual risk:** heuristic filter can miss single-line quotes; batch quality model still **sees** raw turns to produce summaries — retention/logging policy on Bedrock side must match clinical expectations.

---

## 5. Parent privacy

| Control | Status |
|---------|--------|
| Invite code (6 char, 48h, max 5 uses) | ⚠️ `Math.random` — ~31^6 entropy, no rate limit |
| One guardian → one child link | ✅ |
| Parent letter HTML sanitize | ✅ |
| Surprise letter sealed into tale | ⚠️ compose path may not merge letter; photo API can be readable by child before seal |
| Parent report citations without raw chat | ✅ by design |

---

## 6. AI security

| Control | Status |
|---------|--------|
| Controllers never import Bedrock SDK | ✅ |
| Services → Orchestrator for Converse | ✅ with known exceptions |
| Bedrock Guardrails on Converse when configured | ✅ |
| Safety preamble `withBeddySafety` | ✅ on most text prompts |
| Prompt injection (child/parent free text) | ⚠️ mitigated by Guardrails, not eliminated |
| Image/Polly paths outside Converse Guardrails | ⚠️ expected; keep prompts non-PII |

Exceptions that skip Orchestrator observe/Guardrail path: Stability images, Polly, one storybook compose `getLlmProvider().chat()` call — track in Technical Debt.

---

## 7. Secrets & credentials

| Item | Status | Action |
|------|--------|--------|
| `.env` / `.env.local` gitignored | ✅ | Keep |
| Secrets Manager for session + cron | ✅ | Rotate regularly |
| Long-lived AWS keys on laptop / OneDrive | 🔴 | Prefer SSO/role · **rotate if ever pasted** |
| Demo passwords in source + seed scripts | 🔴 for open prod | Disable seed in prod or rotate + restrict |
| `ALLOW_DEV_ROUTES` | ⚠️ | Must be unset in prod |
| `LLM_FALLBACK_TO_MOCK=true` | ⚠️ | Hides outages; set `false` for real demos |

---

## 8. Network & infrastructure security

| Item | Status |
|------|--------|
| ALB HTTPS / ACM | ❌ **P0** |
| S3 public access block / bucket policy scripted | ⚠️ assume private defaults · document & assert |
| ECS task role least privilege | ⚠️ good intent · script overwrite risk |
| Cron shared secret | ✅ if strong & set |
| Rate limiting / WAF | ❌ |
| CSRF | Relies on SameSite=Lax · no extra tokens |

---

## 9. API surface review

| Route class | Risk |
|-------------|------|
| Most feature APIs + `withApiGuard` | Low |
| `GET /api/health` unauthenticated | Info disclosure (env/LLM status) — lock down or strip |
| `POST /api/dev/reset-persona` | Prod 404 unless `ALLOW_DEV_ROUTES` |
| Conversation SSE auth errors | May surface as 500 instead of 401 |
| Cron without secret | 503 (safe) |

---

## 10. Accessibility security-adjacent

Focus trap still missing on dialogs (Phase 4 left open). Not a confidentiality issue; keyboard users can tab behind modals. Track under debt / a11y.

---

## 11. Risk register

### P0 — fix before untrusted traffic

1. Terminate TLS on ALB (or CloudFront HTTPS-only) so `secure` cookies are meaningful.
2. Rotate any AWS keys that lived in `.env.local` / chat / OneDrive; ECS must use task role only.
3. Replace weak/default `AUTH_SESSION_SECRET` and enforce length; use `timingSafeEqual` for HMAC compare.
4. Treat demo passwords as public — rotate for any shared Dynamo table or disable demo seed in production accounts.

### P1 — fix before clinical pilot

5. Rate-limit invite redemption; use `crypto.randomInt` for codes.
6. Harden `/api/health` (auth or minimal public payload); ALB health should use it after dependency checks.
7. Close parent-letter surprise / photo preview gap; seal letter into compose.
8. Retarget storybook compose through Orchestrator + Guardrails.
9. Ensure observability IAM script does not strip TransactWrite / Retrieve.
10. Set `LLM_FALLBACK_TO_MOCK=false` in production task def.

### P2 — improve continuously

11. WAF / API rate limits  
12. Stronger Bridge heuristics / structured redaction  
13. Prompt-injection eval suite  
14. Focus trap on dialogs  
15. Stream path token/cost metrics  
16. `requireChildUser` consistency on child-only APIs  

---

## 12. What is already strong

- Clear Child / Parent / AI responsibility split in services  
- Parent DTOs explicitly exclude raw chat & diary  
- KB path ownership checks  
- Cron timing-safe auth  
- DomainError HTTP contract + most routes behind `withApiGuard`  
- Aurora removed (smaller blast radius)  
- Blob objects private; served through authenticated APIs  

---

## 13. Verdict

**Hackathon / closed demo:** proceed with TLS in front if possible, secrets rotated, mock fallback off, demo accounts known-risk.  
**Open production:** complete P0 list and invite rate limits before advertising a public URL.
