# Bedi

장기 입원 청소년(15–16세)을 위한 AI 디지털 동반자 플랫폼 MVP.

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React
- LLM: OpenAI-compatible API **또는** AWS Bedrock (`@aws-sdk/client-bedrock-runtime`)

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

### 1) Mock (기본)

```env
LLM_PROVIDER=mock
```

키 없이 규칙 기반 한국어 응답.

### 2) OpenAI / 호환 API

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

OpenRouter, Groq, Ollama 등은 `OPENAI_BASE_URL`만 바꾸면 됩니다.

### 3) AWS Bedrock

```env
LLM_PROVIDER=bedrock
AWS_REGION=ap-northeast-2
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
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
