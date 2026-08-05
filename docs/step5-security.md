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

- Secret: `bedi/app` (`AUTH_SESSION_SECRET`, `OPENAI_API_KEY`, `PGPASSWORD`)
- ECS task definition pulls via `secrets` (not plaintext `environment`)
- Script: `scripts/aws/08-secrets.ps1`

## 5-4 DynamoDB auth

Keys:

| pk | sk | purpose |
|----|----|---------|
| `USER#<id>` | `PROFILE` | email, name, role, passwordHash |
| `EMAIL#<email>` | `UNIQUE` | userId (conditional create) |

- Default `AUTH_PROVIDER=dynamodb`
- Production blocks silent mock fallback
- Aurora path kept for rollback (`AUTH_PROVIDER=aurora`) — cluster not deleted yet

### Demo passwords (rotated)

| Role | Email | Password |
|------|-------|----------|
| child | `demo@bedi.app` | `BeddyDemo26!` |
| child | `guest@bedi.app` | `BeddyGuest26!` |
| child | `mina@bedi.app` | `BeddyMina26!` |
| child | `haru@bedi.app` | `BeddyHaru26!` |
| guardian | `guardian@bedi.app` | `BeddyGuard26!` |
| guardian | `parent@bedi.app` | `BeddyParent26!` |

Seed: `npm run seed:dynamo`

## 5-5 deferred

`pg` / Aurora cluster kept until after Friday demo for rollback. Do not delete cluster yet.
