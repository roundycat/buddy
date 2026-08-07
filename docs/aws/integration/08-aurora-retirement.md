# Migration Report — Aurora Retirement

**Date:** 2026-08-06  
**Status:** Complete in application code

## Removed from the app

| Item | Status |
|------|--------|
| `shared/db/postgres.ts` | Deleted earlier |
| `pg` / `@types/pg` | Not in `package.json` |
| `AUTH_PROVIDER=aurora` | Not supported |
| `scripts/deploy/06-aurora-setup.ps1` | Not in repo |
| `seed:aurora` | Not in repo |

Auth is **DynamoDB-only** (`auth.users.dynamo.repo.ts`) plus local `mock` (blocked in production).

## Docs / ops cleanup

- API route comments no longer mention Aurora (`signup`, `delete-account`, `health`)
- Historical notes may remain in `docs/aws/step5-security.md` / `cursor-prompt.md` describing the old lockdown — treat as history
- AWS account may still have a locked-down Aurora cluster; **safe to delete** when cost cleanup is desired (no app dependency)

## Secrets

Prefer Secrets Manager `bedi/app` without `PGPASSWORD` going forward (`AUTH_SESSION_SECRET`, `CRON_SECRET`, optional LLM keys).
