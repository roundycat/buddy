# Final AWS Report

**Project:** Beddy (Bedi)  
**Region:** `us-east-1` (image Bedrock: `us-west-2`)  
**Date:** 2026-08-06

---

## 1. Service map

| AWS service | App status | Provisioning | App entry |
|-------------|------------|--------------|-----------|
| DynamoDB `BediApp` | Live | `04-deploy-ecs-east1.ps1` | `createMapStore`, auth repo |
| S3 (build + blobs) | Live when bucket set | same deploy script | `createBlobStore` |
| Bedrock Converse | Live | account model access | Orchestrator → provider |
| Bedrock Guardrails | Scripted | `09-guardrail.ps1` | `BEDROCK_GUARDRAIL_*` |
| Bedrock Knowledge Bases | Scripted | `11-knowledge-base.ps1` | retrieve + daily index |
| Bedrock Image (Stability) | Live | us-west-2 | avatar / schedule / storybook art |
| Polly | Live | Task role | storybook narration |
| EventBridge | Scripted | `10-eventbridge-cron.ps1` | `POST /api/cron/daily` |
| CloudWatch Metrics/Logs | Live | `07-observability.ps1` | `Beddy` namespace, `/ecs/bedi-app` |
| Secrets Manager | Scripted | `08-secrets.ps1` | `AUTH_SESSION_SECRET`, `CRON_SECRET` |
| ECS Fargate + ALB + ECR | Live | `04-deploy-ecs-east1.ps1` | Dockerfile standalone |
| SNS | Topic only | observability / cron scripts | alarms (subscribe manually) |
| Aurora / RDS | **Retired** | — | no `pg` |

Diagrams: `docs/architecture/architecture-aws.svg`, `docs/aws/integration/00-OVERVIEW.md`.

---

## 2. DynamoDB

### Table

- Name: `BediApp` (`BEDI_DDB_TABLE`)
- Keys: `pk` (S) + `sk` (S)
- Billing: PAY_PER_REQUEST
- TTL attribute: `ttl` (enabled by EventBridge script)
- **GSI: none**

### Key families

| pk | sk | Purpose |
|----|----|---------|
| `MAP#<namespace>` | entity id | Feature documents |
| `USER#<userId>` | `PROFILE` | Auth profile + password hash |
| `EMAIL#<email>` | `UNIQUE` | Email uniqueness (TransactWrite) |
| `BATCH#daily` | date | Dawn batch idempotency lock |

### Index / scale note

List-by-user for photos, diary, hospital schedule, invites, adventure packs uses **partition Query + in-memory filter** (not table Scan). Fine for hackathon/demo scale; needs a `userId` GSI before large multi-tenant load.

Namespaces of note: `personas`, `conversations`, `memories`, `emotion-gardens`, `wish-trees`, `adventure-packs`, `hospital-schedule`, `photo-album`, `picture-diary`, `guardian-invites`, `guardian-links`, `parent-*`, `storybook-*`, …

Full detail: `docs/aws/integration/01-dynamodb.md`.

---

## 3. S3

| Prefix | Content | Access |
|--------|---------|--------|
| `avatars/` | Persona PNGs | Private · served via app |
| `photos/` | Adventure photos | Private |
| `diary/` | Drawing / photo attachments | Private |
| `schedule-images/` | Child-facing schedule art | Private |
| `storybooks/` | Page illustrations | Private |
| `storybook-parent-letters/` | Letter photos | Private |
| `kb-summaries/` | Parent RAG source docs | Private · KB data source |
| `src/bedi-source.zip` | CodeBuild input | Build only |

- Bucket today is often the **same** as CodeBuild (`bedi-codebuild-{account}-us-east-1`). Prefer a dedicated media bucket for production.
- No scripted public ACL; objects are private; API routes gate reads.
- Gaps: dedicated bucket policy doc, SSE-KMS, versioning, lifecycle — not automated yet.

---

## 4. Bedrock & Knowledge Bases

| Concern | Config |
|---------|--------|
| Chat / analysis | `BEDROCK_MODEL_ID_CHAT` (Haiku inference profile) |
| Quality / batch | `BEDROCK_MODEL_ID_QUALITY` (Opus) |
| Guardrail | `BEDROCK_GUARDRAIL_ID` + version after `09-guardrail.ps1` |
| KB | `BEDROCK_KB_ID` after `11-knowledge-base.ps1` (`bedi-child-summaries`) |
| Vectors | S3 Vectors + Titan embeddings (script) |
| Image | Stability Ultra + remove-bg in `us-west-2` |

Retrieve is **owner-scoped** to `kb-summaries/{childUserId}/`. Cross-child drops emit `KbCrossChildDrops`.

---

## 5. EventBridge

| Item | Value |
|------|-------|
| Rule | `bedi-dawn-daily-batch` |
| Schedule | `cron(0 20 * * ? *)` ≈ **05:00 KST** |
| Target | API Destination → `POST {APP}/api/cron/daily` |
| Auth | Connection API key header `x-bedi-cron-secret` |
| App | Timing-safe compare · 503 if secret unset · 202 then fire-and-forget batch |
| Alarm | `Beddy-CronDailyFailures` on `FailedInvocations` |

Jobs (in order): memory consolidate → emotion refine → story update → mission prep → parent summary → KB index.

**Risk:** batch runs in the web task process. Task recycle mid-run can lose work (idempotent claim reduces duplicate starts, not mid-job resume).

---

## 6. CloudWatch

### Namespace `Beddy`

| Metric | Meaning |
|--------|---------|
| `ApiLatencyMs` / `ApiInvocations` / `ApiErrors` | `withApiGuard` |
| `BedrockLatencyMs` / `BedrockFirstTokenMs` | LLM path |
| `InputTokens` / `OutputTokens` / `AiCostUsd` | Cost estimate |
| `DynamoLatencyMs` | Map store get/put |
| `AgentLatencyMs` / `RagLatencyMs` / KB metrics | Agent & parent RAG |
| `BatchLatencyMs` | Dawn jobs |
| Storage error counters | Blob write failures |

Logs: ECS `/ecs/bedi-app` · structured `[bedi:obs]` JSON.

Alarms (scripted): LLM error rate, LLM latency (named P95 but implemented as Average), cron failures. SNS topic `bedi-ops-alerts` — **email subscription is manual**.

Dashboard: `Beddy-Observability` via `07-observability.ps1`.

---

## 7. IAM & Secrets

### Roles (created by scripts)

| Role | Use |
|------|-----|
| `BediEcsTaskExecutionRole` | Pull image + read secrets |
| `BediEcsTaskRole` | DDB, Bedrock, Polly, S3 prefixes, PutMetricData |
| `BediCodeBuildRoleEast1` | Build/push |
| `BediEventBridgeApiDestRole` | Invoke API Destination |
| `BediBedrockKbRole` | KB data source access |

**Order hazard:** `07-observability.ps1` can overwrite Task role policy with a narrower set. Always re-run `04`/`11` policy attachment after observability, or merge policies.

### Secrets Manager

Secret `bedi/app`:

- `AUTH_SESSION_SECRET`
- `CRON_SECRET`

Everything else is ECS plain environment (models, table name, bucket, KB id). Prefer moving any future third-party keys into Secrets Manager.

---

## 8. Deployment topology

```
Developer → zip → S3 → CodeBuild → ECR :latest
                                      ↓
                              ECS Fargate (1 task)
                                      ↓
                              ALB :80 → container :3000
                                      ↓
                         (optional) CloudFront URL in docs
```

| Item | Current |
|------|---------|
| Compute | Fargate 1024 CPU / 2048 MB · desired 1 |
| Image | Node 20 Alpine · Next `standalone` |
| Health check | ALB → **`/login`** (not `/api/health`) |
| TLS | **HTTP listener only** — ACM/HTTPS not in script |
| Grace | 120s · idle timeout 180s |

Health route `GET /api/health` reports env/LLM status JSON and always returns success-shaped payload — it does **not** ping DynamoDB/S3.

---

## 9. Environment variable contract

See `.env.example` and Production Checklist. Cloud must set at minimum:

```
PERSISTENCE=dynamodb
AUTH_PROVIDER=dynamodb
LLM_PROVIDER=bedrock
LLM_FALLBACK_TO_MOCK=false          # recommended for real demos
AUTH_SESSION_SECRET=<strong>
CRON_SECRET=<strong>
AWS_REGION=us-east-1
BEDI_DDB_TABLE=BediApp
AVATAR_S3_BUCKET=<bucket>
BEDROCK_MODEL_ID_CHAT=...
BEDROCK_MODEL_ID_QUALITY=...
BEDROCK_GUARDRAIL_ID=...
BEDROCK_KB_ID=...
NEXT_PUBLIC_APP_URL=https://...
BEDDY_METRICS=1
```

Prefer IAM task role over long-lived access keys on ECS.

---

## 10. AWS readiness scorecard

| Area | Score | Note |
|------|-------|------|
| DynamoDB single-table design | ✅ | GSI later for scale |
| S3 private blobs | ✅ | Split media bucket |
| Bedrock + Guardrail + KB | ✅ | Wire IDs in ECS env |
| EventBridge dawn batch | ✅ | Move to worker for HA |
| CloudWatch metrics | ✅ | Subscribe SNS |
| Secrets Manager | ⚠️ | Only 2 secrets |
| IAM | ⚠️ | Script overwrite risk |
| TLS / HTTPS | ❌ | P0 for real production |
| ALB health = dependency-aware | ❌ | Point to hardened `/api/health` |
| Multi-AZ / desired > 1 | ⚠️ | Demo OK · prod need |

**Verdict:** AWS integration is **complete for a hackathon / controlled pilot**. Hardening items (TLS, health, IAM order, GSI, dedicated S3, SNS subscribers) are checklist work, not greenfield rebuild.
