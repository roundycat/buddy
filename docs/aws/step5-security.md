# STEP 5 — Security + Aurora lockdown + DynamoDB auth

## 5-1 Aurora lockdown (done)

- Revoked `0.0.0.0/0:5432` on `bedi-aurora-sg`
- Ingress remains **ECS SG only** (`sg-05362d81f098217f7`)
- `bedi-aurora-instance` **PubliclyAccessible = false**
- Local machines can no longer reach Aurora over the internet (use `AUTH_PROVIDER=dynamodb`)

## 5-2 S3 TaskRole

- `avatars/*`, `schedule-images/*`, `photos/*` Put/Get/Delete
- Photo S3 put failures emit `S3WriteErrors` metrics

## 5-3 Secrets Manager

- Secret: `bedi/app` (`AUTH_SESSION_SECRET`, `PGPASSWORD`, `CRON_SECRET`)
- ECS task definition pulls via `secrets` (not plaintext `environment`)
- Script: `scripts/deploy/08-secrets.ps1`

## 5-4 DynamoDB auth

Keys:

| pk | sk | purpose |
|----|----|---------|
| `USER#<id>` | `PROFILE` | email, name, role, passwordHash |
| `EMAIL#<email>` | `UNIQUE` | userId (conditional create) |

- Default `AUTH_PROVIDER=dynamodb`
- Production blocks silent mock fallback
- **Aurora auth path removed from the app** (2026-08-06). See [aws-integration/08-aurora-retirement.md](./aws-integration/08-aurora-retirement.md). Cluster may still exist in AWS for manual cost cleanup only.

### Demo passwords (rotated)

| Role | Email | Password |
|------|-------|----------|
| child | `demo@bedi.app` | `(v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정)` |
| child | `guest@bedi.app` | `(v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정)` |
| child | `mina@bedi.app` | `(v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정)` |
| child | `haru@bedi.app` | `(v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정)` |
| guardian | `guardian@bedi.app` | `(v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정)` |
| guardian | `parent@bedi.app` | `(v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정)` |

Seed: `npm run seed:dynamo`

## 5-5 deferred

`pg` / Aurora cluster kept until after Friday demo for rollback. Do not delete cluster yet.
