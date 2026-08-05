# Bedi

장기 입원 청소년(15–16세)을 위한 AI 디지털 동반자 플랫폼 MVP.

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React
- LLM: AWS Bedrock (`@aws-sdk/client-bedrock-runtime`). 로컬은 `LLM_PROVIDER=mock` 가능.

## Architecture

```
UI (frontend) → /api/* (app) → domain services (backend) → LLM providers
```

- `src/frontend` — UI only (backend service import 금지)
- `src/backend` — domain + shared LLM/config
- `src/app/api` — 유일한 브리지

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

## LLM 연결

`.env.local`에서 프로바이더를 고릅니다.

### 1) Mock (로컬 기본)

```env
LLM_PROVIDER=mock
```

키 없이 규칙 기반 한국어 응답. Bedrock 없이 UI·플로우만 확인할 때 사용합니다.

### 2) AWS Bedrock

```env
LLM_PROVIDER=bedrock
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
BEDROCK_MODEL_ID_CHAT=us.anthropic.claude-haiku-4-5-20251001-v1:0
BEDROCK_MODEL_ID_QUALITY=us.anthropic.claude-opus-4-6-v1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

또는 IAM 역할 / AWS CLI 프로필을 사용하세요.

### 상태 확인

```bash
curl http://localhost:3000/api/health
```

대기실에서 보낸 대화는 `POST /api/conversation` → `conversation.service` → `chatWithCompanion()` 경로로 LLM에 연결됩니다.

## 주요 경로

| 경로 | 설명 |
|------|------|
| `/` | 대기실 (페르소나 대화) |
| `/today` | 오늘의 공간 |
| `/timeline` | Bedilog 캘린더 |
| `/api/health` | LLM/환경 상태 |
| `/api/conversation` | 채팅 |
| `/api/persona` | 페르소나 |
| `/api/timeline` | 타임라인 |
