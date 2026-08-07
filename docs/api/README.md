# API surface

HTTP APIs live under `src/app/api/*` (Next.js App Router).

| Area | Base path | Notes |
|------|-----------|-------|
| Auth | `/api/auth/*` | signup, login, logout, delete-account |
| Conversation | `/api/conversation` | SSE stream + history |
| Persona / avatar | `/api/persona/*` | generate, avatar select |
| Child features | `/api/garden`, `/api/wish`, `/api/adventure`, … | feature stores |
| Guardian link | `/api/guardian/*` | invite / link |
| Parent dashboard | `/api/parent/*` | home, timeline, report, schedule, safety-alert |
| Cron | `/api/cron/daily` | EventBridge; requires `x-bedi-cron-secret` |
| Health | `/api/health` | readiness |

Guardians use UI routes under `/guardian` while many dashboard APIs remain under `/api/parent/*` (stable contract).
