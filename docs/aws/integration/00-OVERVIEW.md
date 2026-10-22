# AWS Integration — Phase 2 Overview

**Project:** Beddy (Bedi)  
**Date:** 2026-08-06  
**UX:** unchanged · demo accounts preserved  

## Goal

Replace placeholder / local-only paths with production AWS services, keep Controllers thin, keep Bedrock behind the AI Orchestrator, and keep Child / Parent / AI responsibilities separated.

## Status matrix

| Service | App status | Report |
|---------|------------|--------|
| Aurora → DynamoDB | **Retired** (no `pg` / no AUTH aurora path) | [01-dynamodb.md](./01-dynamodb.md), [08-aurora-retirement.md](./08-aurora-retirement.md) |
| DynamoDB repositories | **Live** via `createMapStore` + auth repo | [01-dynamodb.md](./01-dynamodb.md) |
| Amazon S3 | **Live** via `createBlobStore` when bucket set | [02-s3.md](./02-s3.md) |
| Amazon Bedrock | **Live** via AI Orchestrator → provider | [03-bedrock.md](./03-bedrock.md) |
| Knowledge Bases | **Live** retrieve + daily index job | [04-knowledge-bases.md](./04-knowledge-bases.md) |
| Amazon EventBridge | **Live** cron → `/api/cron/daily` | [05-eventbridge.md](./05-eventbridge.md) |
| Amazon CloudWatch | **Live** `Beddy` metrics + dashboard script | [06-cloudwatch.md](./06-cloudwatch.md) |
| AI Orchestrator | **Contract module** `@/backend/ai/orchestrator` | [07-ai-orchestrator-bridge.md](./07-ai-orchestrator-bridge.md) |
| AI Bridge | **Privacy filter + Guardian RAG** | [07-ai-orchestrator-bridge.md](./07-ai-orchestrator-bridge.md) |

## Call graph (enforced)

```
Child / Parent API routes (Controllers)
        ↓
Feature Services (business logic)
        ↓
AI Orchestrator  ──→  Bedrock Converse / tools / stream
   or stores         DynamoDB / S3
AI Bridge            summaries only → Parent RAG / KB
```

Controllers never import Bedrock SDK or the Orchestrator.  
Feature services never talk to Postgres/Aurora.

## Recovery note (2026-08-06)

Bulk PowerShell rewrite briefly corrupted UTF-8 in some service files; they were restored from git/transcript and typechecked. Mission Agent still plans via Orchestrator `runLlm`; the tool catalogue in `adventure-quest.tools.ts` remains available for the Bedrock tool-use loop.

## Demo accounts (unchanged)

Seed: `npm run seed:dynamo`

| Role | Email | Password |
|------|-------|----------|
| child | demo@bedi.app | (v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정) |
| child | guest@bedi.app | (v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정) |
| child | mina@bedi.app | (v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정) |
| child | haru@bedi.app | (v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정) |
| guardian | guardian@bedi.app | (v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정) |
| guardian | parent@bedi.app | (v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정) |

## Local vs cloud

| Env | Persistence | Auth | LLM |
|-----|-------------|------|-----|
| Local default (`.env.example`) | `json` (`.data`) | `dynamodb` or `mock` | `bedrock` or `mock` |
| Cloud / ECS | `dynamodb` | `dynamodb` | `bedrock` |

JSON mode is a **local developer mirror** of the same repository interface — not a second production database.
