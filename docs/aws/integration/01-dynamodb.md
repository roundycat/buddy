# Migration Report — DynamoDB

**Date:** 2026-08-06  
**Status:** Complete (production path)

## Before

- Structured domain data in local `.data/*.json`
- Auth briefly on Aurora Postgres (`AUTH_PROVIDER=aurora`) — **removed from codebase**

## After

| Concern | Implementation |
|---------|----------------|
| Domain maps | `createMapStore` → `createDynamoMapStore` when `PERSISTENCE=dynamodb` |
| Table | `BEDI_DDB_TABLE` (default `BediApp`) |
| Keys | `pk=MAP#<namespace>`, `sk=<id>` |
| Auth | `auth.users.dynamo.repo.ts` — `USER#` / `EMAIL#` |
| Batch lock | `BATCH#daily` / dateKey conditional Put |

## Repository rule

Feature `*.store.ts` files are the only persistence adapters. Services call stores; stores call Dynamo (or JSON mirror locally). No repository talks to Aurora.

## Env

```
PERSISTENCE=dynamodb
BEDI_DDB_TABLE=BediApp
AWS_REGION=us-east-1
AUTH_PROVIDER=dynamodb
```

## Verify

- `npm run seed:dynamo` — demo users present
- `GET /api/health` → `persistence: "dynamodb"`, `authProvider: "dynamodb"`
- `scripts/deploy/smoke-persist.ts` (if used in CI)

## UX / demos

Unchanged. Same emails/passwords after seed.
