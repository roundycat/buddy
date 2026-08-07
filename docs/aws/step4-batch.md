# STEP 4 — Dawn batch + memory 2-layer + server weather

## What shipped

### Cron
- `POST /api/cron/daily` — header `x-bedi-cron-secret` (`CRON_SECRET`)
- Jobs (in order): memory consolidate → mission prep → parent summary
- EventBridge: `scripts/deploy/10-eventbridge-cron.ps1`
  - Schedule `cron(0 20 * * ? *)` = **05:00 KST**
  - API Destination → CloudFront `/api/cron/daily`
  - Alarm `Beddy-CronDailyFailures` on `AWS/Events` `FailedInvocations`

### Memory (job 1)
- Per-turn `learnFromTurn` is **heuristic only** (no Bedrock)
- Nightly Opus/`quality` consolidate in `memory-consolidate.job.ts`
- 2-layer: volatile themes/tone + `persistentFacts[]` with importance
- Prompt inject: keyword overlap + recency top-N (`formatMemoryForPrompt`)

### Missions + weather (job 2)
- `prepareAdventurePackForDate` pre-generates quests
- Browser → `POST /api/weather` with lat/lon rounded to 1 decimal
- Server Open-Meteo **daily forecast** + in-memory cache; hospital default fallback
- Coarse location TTL 7 days (`expiresAt` + DynamoDB `ttl` attr when enabled)

### Parent prep (job 3)
- `parent-daily-prep` store; `getParentHome` prefers prepared todayMessage / empathyGuide

### Legal
- Location consent rows in `legal-copy.ts` (approx coords only; not via AI Bridge)

## Env / secrets
- `CRON_SECRET` in `.env.local` / Secrets Manager `bedi/app`
- ECS task secret wiring in `04-deploy-ecs-east1.ps1` + `08-secrets.ps1`

## Manual smoke (local)
```bash
# set CRON_SECRET in .env.local, then:
curl -X POST http://localhost:3000/api/cron/daily -H "x-bedi-cron-secret: $CRON_SECRET"
```

## Deploy note
Redeploy ECS after this STEP so production gets cron secret, weather API, and batch code.
