# Migration Report — Amazon EventBridge

**Date:** 2026-08-06  
**Status:** Complete

## Before

Manual / ad-hoc batch triggers.

## After

| Piece | Detail |
|-------|--------|
| Schedule | `cron(0 20 * * ? *)` ≈ 05:00 KST |
| Target | API Destination → `POST {APP}/api/cron/daily` |
| Auth | Header `x-bedi-cron-secret` = `CRON_SECRET` |
| App | `api/cron/daily` → `run-daily-batch.ts` |
| Script | `scripts/deploy/10-eventbridge-cron.ps1` |

No in-app EventBridge SDK client — infrastructure invokes HTTP.

## Jobs (batch)

Memory consolidate, empathy prep, KB index, day-story polish, etc. (see `docs/aws/step4-batch.md`).

## UX

Invisible to users; morning Parent/Child content is ready when they open the app.
