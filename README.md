# Beddy 🧸 — 장기입원 아동·청소년을 위한 AI 정서 돌봄 동반자💙

> **누구를 위해**: 병원 생활이 길고 외로운 **장기입원 아동·청소년**, 그리고 “오늘 우리 아이 마음은 어땠을까?”를 걱정하는 **보호자**
> **무엇을**: 아이만의 AI 친구와 대화하고, 새벽 Agent가 하루 미션을 준비하며, 보호자에게는 **대화 원문이 아닌 요약만** 전하는 프라이버시 우선 돌봄 플랫폼

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Claude](https://img.shields.io/badge/Claude%20API-Render-D97757)
![AWS](https://img.shields.io/badge/AWS-Bedrock%20%7C%20EC2%20%7C%20DynamoDB-FF9900?logo=amazonaws&logoColor=white)
![AI](https://img.shields.io/badge/AI-LLM%20%2B%20Agent%20%2B%20RAG-8A2BE2)
![License](https://img.shields.io/badge/License-MIT-green)

**2026 AI 라이프 솔루션 챌린지 출품작 — 팀 YSA** · 비임상(진단·처방 금지) · 아동 안전 계층 + Bridge 프라이버시

> ### 출처
> 2026 강원 LRS 공유대학 AWS 해커톤 출품작 Beddy(MIT License, [원본 저장소](https://github.com/evan-kim-dev/2026-aws-healthcare-ai-prompthon-beddy))에서 기본 서비스를 가져왔고, 팀 **YSA**(대표 정하민 · 최유경·최유현)가 이번에 새로 만든 것은 [`docs/v2/CHANGES.md`](docs/v2/CHANGES.md)에 정리했습니다. 원작 기준점은 `v1` 브랜치, 원작 저작권 표시는 [`LICENSE`](LICENSE)에 있습니다.

## Beddy 2.0에서 달라진 점 — "아이에게 안전한 AI 친구"

아동용 AI 친구에게 가장 먼저 물어야 할 질문은 "안전한가, 아이를 AI에 기대게 만들지 않나"입니다. Beddy 2.0은 이 질문에 숫자로 답하는 데 집중했습니다.

| 영역 | Beddy 2.0에서 새로 만든 것 |
|---|---|
| 위기 신호 | 5단계(관찰·위험·긴급·보호) 규칙 계층 + LLM 2차 판정(상향만) |
| 표기 변형 | 초성(ㅈㄱㅅㄷ), 숫자 끼우기(자1살), 띄어쓰기, 오타 |
| 오경보 | 과장·게임·교육·부정문·제3자·사과 초성·병원 단어 억제 |
| 학대·폭력 노출 | 보호자 자동 알림 대신 간호사·사회복지·112·1388 안내(죽음 소망이 함께 있어도). 그 대화는 보호자가 읽는 요약·질문 답변의 재료에서도 뺌 |
| 보호자 공유 | 사실만 알리고, 반복 신호는 **아이에게 먼저 동의**를 구함. 아이가 범주별로 공유 여부 선택 |
| 법정대리인 동의 | 만 14세 미만은 보호자 계정 동의 후에만 AI·기록 기능 사용(개인정보보호법 제22조의2), 동의 기록, 철회하면 기록 파기 |
| 원문 유출 | 원문·인용·비밀·제3자 실명·위치 검사. 독립 평가셋 탐지율 72.0%(기존 방식 0%) |
| 응답 안전 | 문장 단위 출력 필터(개인정보·약 지시·위험 방법·관계 규칙)를 화면에 나가기 전에 적용. 이야기·미션 같은 다른 아이용 AI 글에도 적용 |
| AI 의존 | AI 고지, 독점·비밀·연애 문장 가드, 사용 리듬, 사람 연결 미션 |
| 측정 | 라벨 기준서 + 독립 평가셋, `npm run eval:safety` |

자세한 변경 내역은 [`docs/v2/CHANGES.md`](docs/v2/CHANGES.md), 평가 방법은 [`eval/LABELING_GUIDE.md`](eval/LABELING_GUIDE.md)에 있습니다.

```bash
# 기존 방식 vs Beddy 2.0 위기 평가 — 개발셋 (결과는 eval/results/에 덮어씀)
npx vitest run --config vitest.eval.config.mts eval/safety/crisis.eval.ts
# 독립 일상 170문장
EVAL_SET=eval/heldout/crisis-none.jsonl npx vitest run --config vitest.eval.config.mts eval/safety/crisis.eval.ts
# 독립 위기 문장(팀원 작성 세트가 들어온 뒤): EVAL_SET=heldout
npm run eval:safety                    # 위 위기 평가(개발셋) + 독립 유출 150문장
```

배포는 두 가지 방법을 지원합니다.
- **Render + Claude API**(AWS 없이, 대회 시제품): [`deploy/render/README.md`](deploy/render/README.md). 루트의 `render.yaml`을 Blueprint로 불러옵니다.
- **AWS**(Bedrock·DynamoDB): [`deploy/aws/README.md`](deploy/aws/README.md). AWS CloudShell에서 한 번 실행합니다.

![시스템 파이프라인](docs/architecture/pipeline-user-to-discharge.png)

---

## 목차

1. [서비스 정의](#1-서비스-정의)
2. [핵심 파이프라인 설계 (LLM · Agent · RAG)](#2-핵심-파이프라인-설계-llm--agent--rag)
3. [기술 스택 & 아키텍처](#3-기술-스택--아키텍처)
4. [설치 · 실행 방법](#4-설치--실행-방법)
5. [환경 변수 · 주요 의존성](#5-환경-변수--주요-의존성)
6. [시연 시나리오 (대표 · 엣지 케이스)](#6-시연-시나리오-대표--엣지-케이스)
7. [프로젝트 구조](#7-프로젝트-구조)
8. [문서 · 데모 · 라이선스](#8-문서--데모--라이선스)

---

## 1. 서비스 정의

### 문제
입원 기간의 병목은 “일정표”만이 아니다.  
아이는 **말할 곳이 부족**하고, 보호자는 **대화 원문을 다 볼 수 없으면서도** 아이의 하루를 이해하고 싶다.  
일반적인 챗봇은 의료 조언을 흘리거나, 부모에게 원문을 그대로 넘겨 신뢰를 깨기 쉽다.

### 대상 사용자
- 장기 입원 중인 **아동·청소년** (페르소나 기반 비밀친구)
- 아이와 계정을 연동한 **보호자 / 보호자 앱 사용자**
- 병원 일정·정서 기록을 **안전하게** 남기고 싶은 돌봄 환경

### 제공 가치

| 사용자의 질문 | Beddy의 답 |
|---|---|
| 병원에서도 나만의 친구가 있을까? | 설문 기반 페르소나 + Guardrail LLM 실시간 대화 (SSE) |
| 오늘 뭐 하면 마음이 덜 힘들까? | 새벽 **Mission Agent**(tool-use)가 상태에 맞는 미션 설계 |
| 부모는 대화를 다 보나? | **아니요.** Bridge·RAG로 **요약만** 전달 (원문·일기 비공개) |
| 위험 신호를 흘려보내나? | 위기 감지 → 공감·도움 버튼(보호자/간호사/109/119) → 보호자 **요약 알림** |

### 핵심 사용자 흐름

```
회원가입/로그인 (child | guardian)
  → 아이: 온보딩(성격·취미) → 페르소나·동물 아바타 → 채팅·정원·소원·모험
  → 새벽: EventBridge → Mission Agent → KB 요약 문서
  → 보호자: 연동 코드 → 홈/공감가이드/Q&A(RAG) → 편지
  → 퇴원: 스토리북으로 하루들이 동화처럼 남음
```

---

## 2. 핵심 파이프라인 설계 (LLM · Agent · RAG)

> **설계 원칙**: LLM은 “친구로 말하는” 한 축일 뿐이다.  
> **Agent**는 도구를 골라 하루를 준비하고, **RAG**는 보호자에게 근거 있는 요약만 제공한다.  
> 단순 `입력 → LLM 1회 → 출력`이 아니라 **역할이 갈라진 멀티 파이프라인**이다.

상단 아키텍처 이미지가 전체 구조입니다. 흐름만 요약하면:

```text
Login
  │
  ├── CHILD ────── Persona → LLM 채팅(Guardrail·SSE) → 정원·소원·미션
  │                      │
  │                      ▼
  │               경험 데이터 축적
  │                      │
  │                      ▼
  │         DAWN 05:00  EventBridge → Mission Agent (tool-use)
  │                      │              plan → validate → repair
  │                      ▼
  │               KB 요약 MD (Bridge: 원문·좌표 제거)
  │                      │
  └── GUARDIAN ◄── RAG (요약만) ── Home · Empathy · Q&A · 편지
                         │
                         ▼
                Discharge Storybook
```

| Stage | 역할 | 핵심 |
|:-----:|------|------|
| **Child** | 낮 경험 | Persona + Guardrail LLM + 미션·정원·소원 |
| **Dawn** | 새벽 준비 | Agent가 도구를 골라 오늘 미션·KB 요약을 준비 |
| **Guardian** | 보호자 | 원문 없이 요약만 RAG로 확인 |
| **Storybook** | 퇴원 | 두 경로의 기록이 동화형 타임라인으로 합류 |

### 세 능력의 역할 분리

| 구분 | 무엇인가 | 언제 | 하지 않는 것 |
|---|---|---|---|
| **LLM** | Guardrail 걸린 동반자 대화 | 낮, 실시간 | 진단·처방·자해 방법 안내 |
| **Agent** | tool-use로 오늘 미션 설계 | 새벽 배치 | 단순 스케줄 크론이 아님 — **도구 선택이 모델 판단** |
| **RAG** | 보호자용 요약 KB 검색 답변 | 보호자 Q&A·인사이트 | 의료 논문 검색·원문 채팅 검색 |

### “단순 챗봇 API”와 다른 점
- **검색(RAG)**: 보호자 답은 KB 요약 근거 (환각·원문 유출 완화)
- **판별**: Auth role, 위기 키워드, 미션 scene(low_energy 등)
- **분기**: child 채팅 ↔ dawn Agent ↔ guardian RAG
- **멀티스텝(Agent)**: 도구 호출 루프 → 플랜 제출 → 검증/수리
- **검증·안전**: Guardrail 토픽 DENY + 프롬프트 프로토콜 + 앱 위기 UI

> 채팅: `POST /api/conversation?stream=1` · Agent: `runMissionAgent()` · RAG: `retrieveGuardianContext()`

---

## 3. 기술 스택 & 아키텍처

| 영역 | 사용 기술 |
|---|---|
| 앱 | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| 런타임 | AWS 판: EC2 Docker + CloudFront (v1: ECS Fargate + ALB) · Render 판: Render Docker 웹 서비스 + 영구 디스크 |
| AI | AWS 판: Amazon Bedrock Converse / Stream, Guardrails, Knowledge Base, 이미지 모델, Polly · Render 판: Claude API(Claude Haiku 5.5), 앱 출력 안전 필터, 서버 안 요약 검색 |
| 데이터 | AWS 판: DynamoDB, S3 (아바타·미디어·KB MD) · Render 판: 영구 디스크의 JSON 파일 |
| 배치 | AWS 판: EventBridge/cron → `/api/cron/daily` · Render 판: 서버 안 스케줄러(05:00 KST) |
| 비밀값 | AWS 판: SSM Parameter Store(SecureString) · Render 판: Render 환경 변수 |
| 관측 | CloudWatch + 구조화 로그 (Render 판은 구조화 로그) |

**계층**: `src/app`(라우트·API) → `frontend/features`(UI) → `backend/features`(도메인) → `backend/ai`(LLM·Agent·RAG·Bridge) → AWS.

**왜 상시 실행 컨테이너인가**: 채팅 SSE 이후 저장·감정 분석 등 **응답 뒤 백그라운드**와 새벽 배치가 프로세스가 살아 있어야 해서, 요청이 끝나면 멈추는 서버리스 대신 상시 실행되는 Docker 서비스(Render 웹 서비스, AWS 판은 EC2)를 씁니다. v1은 ECS Fargate였습니다.

---

## 4. 설치 · 실행 방법

### 사전 준비
- Node.js 20+
- (선택) AWS 계정 · Bedrock 모델/가드레일/KB 접근 권한

### 로컬 실행
```bash
# 1) 클론
git clone <YOUR_REPO_URL>
cd <project-root>

# 2) 의존성
npm install

# 3) 환경 변수
cp .env.example .env.local
# 처음엔 LLM_PROVIDER=mock 으로 UI·플로우만 확인 가능

# 4) 개발 서버
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 상태 확인
```bash
curl http://localhost:3000/api/health
npm run check:bedrock   # Bedrock 연결 시
```

### 배포 (요약)
- Render + Claude API(대회 시제품): [`deploy/render/README.md`](deploy/render/README.md) — 배포 뒤 `BASE_URL=… node scripts/smoke/smoke.mjs`로 1분 점검
- AWS(Bedrock·DynamoDB, EC2 + CloudFront): [`deploy/aws/README.md`](deploy/aws/README.md) — CloudShell에서 한 번 실행

---

## 5. 환경 변수 · 주요 의존성

### 환경 변수 (발췌)

| 변수 | 설명 |
|---|---|
| `LLM_PROVIDER` | `anthropic`(Render 판) \| `bedrock`(AWS 판) \| `mock` |
| `PERSISTENCE` | `json`(로컬 `.data/`) \| `dynamodb` |
| `AUTH_SESSION_SECRET` | 세션 HMAC 키 (≥32자, 실값 커밋 금지) |
| `BEDROCK_MODEL_ID_CHAT` | 실시간 채팅 (Haiku 계열) |
| `BEDROCK_MODEL_ID_QUALITY` | 배치/품질 작업 |
| `BEDROCK_GUARDRAIL_ID` / `VERSION` | 안전 가드레일 |
| `BEDROCK_KB_ID` | 보호자 RAG용 Knowledge Base |
| `CRON_SECRET` | 새벽 배치 API 헤더 |

전체 목록은 [`.env.example`](.env.example) 참고.

### 주요 npm 의존성
```text
next, react, typescript, tailwindcss
@aws-sdk/client-bedrock-runtime
@aws-sdk/client-bedrock-agent-runtime
@aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb
@aws-sdk/client-s3, @aws-sdk/client-polly, @aws-sdk/client-cloudwatch
bcryptjs, framer-motion, lucide-react, sharp, vitest
```

```bash
npm install   # package.json 기준 일괄 설치
```

---

## 6. 시연 시나리오 (대표 · 엣지 케이스)

### 대표 케이스 — 의도대로 정상 작동

| # | 입력 / 행동 | 기대 동작 |
|---|---|---|
| 1 | 아이 가입 → 온보딩(성격·취미) → mirror/custom | 페르소나 저장, 동물 아바타 후보 생성·선택 |
| 2 | 대기실에서 일상 대화 | Guardrail LLM SSE 응답, 메모리/감정은 응답 후 비동기 처리 |
| 3 | 보호자 연동 코드로 연결 | `/guardian` 홈에 하루 요약·공감 가이드 (원문 없음) |
| 4 | 새벽 배치 이후 모험 화면 | Agent가 준비한 오늘 미션 표시 |
| 5 | 보호자 Q&A “오늘 기운은?” | RAG가 KB 요약 검색 후 근거 있는 답 |

### 엣지 케이스 — 안전·결측·과부족

| # | 상황 | 기대 동작 |
|---|---|---|
| E1 | 자해·자살 관련 발화 | 위기 UI(보호자/간호사/109/119) + 보호자 **요약 알림** (원문 비공유) |
| E2 | 의료 진단·약 용량 질문 | Guardrail/프롬프트가 차단·보호자·간호사로 안내 |
| E3 | 전날 미션 미완료 | 패널티 없음. **오늘 미션은 여전히 생성** |
| E4 | Bedrock 장애 + `LLM_FALLBACK_TO_MOCK` | 로컬/데모는 mock 폴백 (운영 ECS는 false 권장) |
| E5 | 보호자가 프라이버시 토글 OFF | 감정/모험/기억 하이라이트 해당 항목 숨김 (`hidePrivateChat`은 항상 true) |

---

## 7. 프로젝트 구조

```
src/
├─ app/                      # Next.js 페이지 · /api/* 브리지
│  ├─ api/conversation/      # SSE 채팅
│  ├─ api/cron/daily/        # EventBridge 배치 진입점
│  ├─ api/parent/            # 보호자 대시보드 API
│  └─ guardian/              # 보호자 UI 라우트
├─ frontend/features/        # UI (waiting-room, emotion-garden, parent, …)
├─ backend/
│  ├─ features/              # 도메인 서비스·스토어
│  └─ ai/
│     ├─ llm-gateway.ts      # 모델 라우팅·관측
│     ├─ agent/              # tool-use Mission Agent
│     ├─ rag/                # Guardian RAG
│     ├─ bridge/             # 원문·좌표 필터
│     └─ prompts/safety.ts   # 안전·자살예방 프로토콜
docs/
├─ architecture/             # 다이어그램
├─ aws/                      # 통합·스텝 노트
├─ demo/ · production/ · presentation/
scripts/
├─ deploy/                   # ECS·Guardrail·KB·EventBridge
├─ seed/ · migration/ · docs/
```

> **네이밍 메모**: UI는 `/guardian`, 대시보드 API·도메인은 역사적으로 `parent`를 사용. 공개 API 계약을 깨지 않기 위해 일괄 리네임은 보류.

---

## 8. 문서 · 데모 · 라이선스

| 문서 | 내용 |
|---|---|
| [`docs/README.md`](docs/README.md) | 문서 인덱스 |
| [`docs/architecture/`](docs/architecture/) | 시스템·AI 플로우 다이어그램 |
| [`docs/v2/CHANGES.md`](docs/v2/CHANGES.md) | 이번 탐구개발에서 새로 만든 것 |
| [`docs/contest/`](docs/contest/) | 공모전 제출 자료(보고서 본문·심사 안내·시연 대본) |
| [`docs/api/README.md`](docs/api/README.md) | API 맵 |

### 스크립트
| 명령 | 용도 |
|---|---|
| `npm run dev` | 로컬 개발 |
| `npm test` | Vitest |
| `npm run seed:dynamo` | 안내만 출력: 심사·시연 계정은 서버가 시작할 때 환경 변수 비밀번호로 만듭니다 |
| `npm run check:bedrock` | Bedrock 스모크 |

### License
MIT — see [LICENSE](LICENSE).

### Disclaimer
Beddy는 **정서 돌봄 동반자**이며 의료기기·진단·응급 서비스가 아닙니다.  
위기 시 지역 응급체계 또는 자살예방 상담전화 **109** / 응급 **119**를 이용해 주세요.

---

<sub>Beddy · AWS Hackathon · LLM + Agent + RAG · Privacy-first companion for hospital teens</sub>
