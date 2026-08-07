# Deployment Checklist

**Project:** Beddy (Bedi)  
**Region:** us-east-1  
**Primary script:** `scripts/deploy/04-deploy-ecs-east1.ps1`

Use this when shipping a new image or provisioning a fresh account.

---

## A. Preconditions

- [ ] AWS CLI configured for the target account (`aws sts get-caller-identity`)
- [ ] PowerShell can run `scripts/deploy/_aws.ps1`
- [ ] Docker not required locally (CodeBuild builds) — or local build verified
- [ ] `NEXT_PUBLIC_APP_URL` known (CloudFront or ALB DNS)
- [ ] Bedrock model access enabled in **us-east-1** (Converse) and **us-west-2** (Stability)
- [ ] No production `ALLOW_DEV_ROUTES=1`

---

## B. First-time account bootstrap (order matters)

Run once per account (or after intentional teardown):

| # | Script | Produces |
|---|--------|----------|
| 1 | `08-secrets.ps1` | Secrets Manager `bedi/app` · write ARN to `last-secret-arn.txt` |
| 2 | `04-deploy-ecs-east1.ps1` | DynamoDB, ECR, S3, CodeBuild, IAM, ALB, ECS service |
| 3 | `09-guardrail.ps1` | Guardrail id → `last-guardrail.json` |
| 4 | `11-knowledge-base.ps1` | KB id → `last-kb-id.txt` · Task role Retrieve |
| 5 | `10-eventbridge-cron.ps1` | Dawn rule + API Destination · needs live HTTPS/HTTP app URL |
| 6 | `07-observability.ps1` | Dashboard + alarms + SNS |

**After step 6:** re-verify Task role still has Dynamo TransactWrite, Bedrock Retrieve, Guardrail, S3 prefixes. If observability overwrote IAM, re-apply from `04`/`11`.

- [ ] Bootstrap complete  
- [ ] IAM verified post-observability  

---

## C. Application environment (ECS task)

Confirm task definition env / secrets:

### Secrets (from Secrets Manager)

- [ ] `AUTH_SESSION_SECRET` — long random (≥32 chars)
- [ ] `CRON_SECRET` — long random · matches EventBridge Connection

### Plain env

- [ ] `PERSISTENCE=dynamodb`
- [ ] `AUTH_PROVIDER=dynamodb`
- [ ] `LLM_PROVIDER=bedrock`
- [ ] `LLM_FALLBACK_TO_MOCK=false`
- [ ] `AWS_REGION=us-east-1`
- [ ] `BEDI_DDB_TABLE=BediApp`
- [ ] `AVATAR_S3_BUCKET=…`
- [ ] `AVATAR_S3_REGION=us-east-1`
- [ ] `BEDROCK_MODEL_ID` / `_CHAT` / `_QUALITY`
- [ ] `BEDROCK_GUARDRAIL_ID` + `BEDROCK_GUARDRAIL_VERSION`
- [ ] `BEDROCK_KB_ID`
- [ ] `BEDROCK_IMAGE_MODEL_ID` + `BEDROCK_IMAGE_REGION=us-west-2`
- [ ] `NEXT_PUBLIC_APP_URL=https://…` (or http:// for lab only)
- [ ] `BEDDY_METRICS=1`
- [ ] `PORT=3000` / `HOSTNAME=0.0.0.0` (if required by image)

### Must be absent / false

- [ ] `ALLOW_DEV_ROUTES` unset
- [ ] No long-lived `AWS_ACCESS_KEY_ID` on the task (use task role)

---

## D. Build & roll out

- [ ] Commit / zip source as deploy script expects
- [ ] Run `04-deploy-ecs-east1.ps1` (or trigger CodeBuild) → new `:latest`
- [ ] ECS service redeployed · tasks healthy
- [ ] ALB target health: healthy
- [ ] `last-deploy-url.txt` updated

Manual image check:

```bash
curl -sS "$APP_URL/login" | head
curl -sS "$APP_URL/api/health"
```

---

## E. Data seed (demo)

- [ ] `npm run seed:dynamo` against the **intended** table only
- [ ] Child login `demo@bedi.app` works
- [ ] Guardian login `guardian@bedi.app` works
- [ ] Guardian link flow smoke-tested once

---

## F. EventBridge & batch

- [ ] Rule `bedi-dawn-daily-batch` ENABLED
- [ ] API Destination URL points at current `NEXT_PUBLIC_APP_URL`
- [ ] Connection header secret matches `CRON_SECRET`
- [ ] Manual smoke:

```bash
curl -X POST "$APP_URL/api/cron/daily" \
  -H "x-bedi-cron-secret: $CRON_SECRET"
```

Expect **202**. Check CloudWatch logs for batch phases.

- [ ] Optional: `?force=1` only in non-prod

---

## G. Observability

- [ ] Log group `/ecs/bedi-app` receiving lines
- [ ] Metrics namespace `Beddy` showing `ApiInvocations` after traffic
- [ ] Dashboard `Beddy-Observability` opens
- [ ] SNS `bedi-ops-alerts` has an email/Slack subscription confirmed
- [ ] Test alarm or publish SNS once

---

## H. Post-deploy verification matrix

| Check | Pass? |
|-------|-------|
| Child chat streams (SSE) | [ ] |
| Garden plant / water | [ ] |
| Wish hang | [ ] |
| Adventure open | [ ] |
| Photo upload lands in S3 prefix | [ ] |
| Guardian home shows summaries (no raw chat) | [ ] |
| Guardian report with KB label | [ ] |
| Cron 202 + log evidence | [ ] |
| `/api/dev/reset-persona` is 404 in prod | [ ] |

---

## I. Rollback

- [ ] Previous ECR image digest recorded
- [ ] ECS update-service to prior task definition revision
- [ ] DynamoDB is additive — do not wipe tables casually
- [ ] If bad secret: rotate Secrets Manager version · force new deployment

---

## J. Known deploy footguns

1. Running `07-observability.ps1` last without re-checking IAM  
2. Leaving `LLM_FALLBACK_TO_MOCK=true` — demo “works” with fake answers  
3. EventBridge still pointing at an old CloudFront URL  
4. Seeding production with demo passwords and sharing the URL publicly  
5. ALB on :80 only while cookies expect HTTPS  
