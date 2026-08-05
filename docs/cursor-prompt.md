# Cursor 작업 프롬프트 — Beddy AWS 프로덕션 마이그레이션

> Cursor 채팅에 이 문서 전체를 붙여넣고 `STEP 0부터 시작해`라고 지시하세요.
> STEP 하나가 끝날 때마다 커밋하고, 다음 STEP만 다시 지시하면 됩니다.

---

## 0. ROLE

You are the Principal Software Architect and Principal AWS Solutions Architect for **Beddy** — an AI digital companion for long-term hospitalized children.

Beddy is **not** a medical chatbot. No diagnosis, no prescription, no clinical interpretation of test values. The purpose is emotional support, memory preservation, personalized daily activities, and helping guardians understand their child.

프로젝트는 이미 동작합니다. UI·UX·비즈니스 흐름은 대부분 구현되어 있습니다.
당신의 일은 **재설계가 아니라 이관과 최적화**입니다.

## 0-1. HARD RULES (위반하면 작업 중단)

1. **UI/UX를 재설계하지 마세요.** 컴포넌트 구조·화면 흐름·디자인 토큰을 바꾸지 마세요.
2. **동작하는 코드를 다시 쓰지 마세요.** 확장하거나 감싸세요.
3. **기능을 삭제해서 단순화하지 마세요.**
4. 한 파일을 200줄 이상 고쳐야 하면 **먼저 물어보세요.**
5. 각 작업 후 `npx tsc --noEmit` 통과를 확인하세요. 실패 상태로 다음으로 넘어가지 마세요.
6. 새 추상화를 만들기 전에 **기존 추상화를 먼저 찾으세요** (3번 CURRENT STATE 참조).
7. "Dependency Injection"을 문자 그대로 해석해 DI 컨테이너를 도입하지 마세요. 현재 모듈 레벨 함수 구조를 유지합니다.
8. 확실하지 않으면 추측하지 말고 질문하세요.

---

## 1. 핵심 원칙 — 아동 공간과 보호자 공간의 분리

아이는 AI 동반자를 **믿을 수 있는 친구**로 느껴야 합니다. 보호자는 **감시가 아니라 이해**를 받아야 합니다.

보호자 앱은 다음에 **절대** 접근하지 못합니다.
- 대화 원문
- 일기 원문
- 개인적인 기억
- 원본 AI 대화

두 공간을 잇는 통로는 **단 하나**, `AI Bridge` 입니다.

### AI Bridge

| 책임 | 내용 |
|---|---|
| 관련 기억 검색 | Knowledge Base 로 필요한 것만 |
| 프라이버시 필터 | 민감 정보 제거 |
| 보호자용 요약 생성 | AI 가 생성한 요약만 통과 |
| 공감 코칭 · 소통 안내 | 어떻게 말을 걸면 좋을지 |

**불변식**: 보호자 응답에 대화 원문·일기 원문·사진 바이너리가 포함되면 **버그**입니다.
통과 가능한 것: AI 생성 요약, 감정 라벨, 키워드, 미션 제목, 집계 수치.

---

## 2. 이미 내려진 결정 (다시 묻지 마세요)

| 항목 | 결정 |
|---|---|
| 런타임 | **ECS Fargate 유지.** Lambda 로 옮기지 않습니다 (응답 후 백그라운드 작업이 깨짐) |
| 관계형 DB | **Aurora 완전 제거.** users 테이블을 DynamoDB 로 흡수 |
| 데이터 저장소 | **DynamoDB 단일 테이블** `BediApp` — 구조화 데이터 전부 |
| 바이너리 | **S3** — 사진 · 아바타 · 삽화 · 스토리북 |
| 벡터 스토어 | **S3 Vectors** — 새 클러스터 없이 KB 인덱스를 S3 에 둠 |
| RAG | **Knowledge Bases for Bedrock** (S3 Vectors 백엔드) |
| 인증 | 현재 HMAC 세션 + 역할 게이트 유지. **Cognito 도입 안 함** |
| 대화 모델 | **Haiku 계열** (빠름) |
| 배치·품질 모델 | **Opus** (지연 무관) |

---

## 2-1. 예산과 기간 — 비용은 제약이 아닙니다. 시간이 제약입니다.

프로젝트는 **이번 주 금요일에 종료**됩니다. AWS 크레딧 $200 이 있고, 4일 운영 기준 현재 구성은 약 $13 입니다. 크레딧의 7% 입니다.

**비용을 이유로 어떤 결정도 내리지 마세요.**

| 항목 | 방침 |
|---|---|
| Bedrock 실험 | 완전히 자유. 프롬프트 반복 · 아바타 재생성 · 배치 재실행 아끼지 마세요 |
| 배치 모델 | Opus 마음껏 사용 |
| CloudWatch | 커스텀 메트릭 · 대시보드를 넓게. 항목을 고르지 마세요 |
| X-Ray | 추가하세요. 대화 한 턴이 여러 호출로 갈라져 분산 추적이 유용합니다 |
| Aurora | 인증 이관 후에도 **금요일까지 병행 유지**해 롤백 여지 확보 |
| Fargate | 데모 당일 2 vCPU 로 일시 상향 (`sharp` CPU 점유 대비) |

**비용이 아니라 다른 이유로 유지되는 결정**
- **S3 Vectors (OpenSearch Serverless 아님)** — 이유는 비용이 아니라 **셋업 시간**입니다. 클러스터 · VPC 설정 · 인덱스 스키마가 없습니다. 4일 마감에서는 이것만이 기준입니다
- **대화 모델은 Haiku** — **속도** 때문입니다. Opus 는 첫 토큰까지가 가장 느립니다
- **Aurora 제거** — `5432` 인터넷 노출 · VPC 의존 · 커넥션 풀 · 평문 시크릿 때문입니다
- **Cognito 제외** — 시간 제약입니다

### 4일 일정 (화 → 금)

| 언제 | STEP |
|---|---|
| 화요일 (남은 시간) | STEP 0 (30분) + STEP 1 속도 |
| 수요일 | STEP 2 계측 + STEP 5 보안 · Aurora 이전 |
| 목요일 | STEP 3 Orchestrator · Guardrails + STEP 4 배치 · 메모리 |
| 금요일 | 오전 STEP 6 KB · 오후 STEP 7 리허설 |

**Aurora 이전(STEP 5-4)은 수요일에 시작하지 못하면 포기하세요.** 로그인 경로를 건드리므로 고칠 시간이 남아 있어야 합니다. 대신 STEP 5-1(SG 회수, 10분)과 5-2(S3 권한)는 반드시 하세요.

### 밀릴 때 버리는 순서
1. **STEP 6 KB** — 설계를 문서로 설명. 아키텍처 서사는 그대로 성립합니다
2. **STEP 4 의 잡 3** (보호자 요약 사전 생성) — 잡 1·2 만 남김
3. **STEP 5-4 Aurora 이전**

**절대 버리지 말 것**: STEP 1 (속도 목표), STEP 5-1 (아동 데이터가 담긴 DB 가 인터넷에 열려 있음)

### 금요일 이후 정리
발표 종료 후 ECS 서비스 desired count 를 0 으로, Aurora · ALB 삭제.
잊고 두면 월 $100 씩 크레딧이 소진됩니다. AWS Budgets 알람 하나를 안전망으로 걸어두세요.

---

## 3. CURRENT STATE — 이미 존재하는 것 (재발명 금지)

실제 파일 경로입니다. 새로 만들지 말고 확장하세요.

### 규모
페이지 19 · API 라우트 37 · 도메인 기능 19 · DynamoDB 네임스페이스 17

### LLM 계층 (프로바이더 추상화 이미 완료)
```
src/backend/shared/llm/index.ts
  getLlmProvider()        프로바이더 해석 + 캐시
  chatWithCompanion()     단발 응답
  streamWithCompanion()   토큰 스트리밍
  getLlmStatus()
src/backend/shared/llm/providers/{bedrock,openai,mock}.provider.ts
src/backend/shared/llm/prompts/companion.ts
src/backend/shared/llm/parse-json.ts        extractJsonObject
```
Bedrock 대화는 `ConverseCommand`. 이미지는 `InvokeModel` + Stability (us-west-2).

### 프롬프트가 흩어진 곳 (STEP 3 통합 대상)
```
src/backend/features/emotion-analysis/emotion.service.ts
src/backend/features/hospital-day/schedule-copy.llm.ts
src/backend/features/growth-journal/growth-journal.service.ts
src/backend/features/adventure-quest/adventure-story.service.ts
src/backend/features/conversation/memory.service.ts
```
"의료 진단 금지" 규칙이 파일마다 **따로** 적혀 있습니다. 한 곳만 고치면 나머지는 안 바뀝니다.

### 대화 경로 — 현재 성능 문제의 핵심
```
src/backend/features/conversation/conversation.service.ts
  resolveCompanionContext()  persona → history → memory → wishes 를 순차 await (4회 왕복)
  sendMessage()              단발
  streamMessage()            SSE 제너레이터
  persistTurn()              저장 + learnFromTurn + analyzeChatEmotion  ← Promise.all 로 await
src/backend/features/conversation/conversation.store.ts   히스토리 80턴 상한
src/backend/features/conversation/memory.service.ts       learnFromTurn — 매 턴 LLM 호출
src/backend/features/emotion-analysis/emotion.service.ts  감정 분석 — 매 턴 LLM 호출
src/app/api/conversation/route.ts                         Accept: text/event-stream → SSE
```
**문제**: 한 턴에 Bedrock 3회(응답 1 + 메모리 추출 1 + 감정 분석 1). 뒤 2개가 `persistTurn` 안에서 `await` 되어 SSE `done` 이벤트를 막습니다. 아이는 글이 끝났는데 입력창이 몇 초 안 풀립니다.

### 메모리 — 기억이 사라지는 구조
```
src/backend/features/conversation/memory.types.ts
  speechStyleNotes    string
  preferredToneNotes  uniquePush(..., 8)
  emotionalThemes     uniquePush(..., 8)
  importantFacts      uniquePush(..., 12)   ← slice(-12) 로 오래된 기억이 조용히 탈락
```
장기 입원 아이인데 "기억할 사실"이 12개 상한입니다.

### AI Bridge 에 해당하는 기존 코드
```
src/backend/features/parent/parent.service.ts
  getParentHome() / getParentTimeline() / askParentReport() / getParentProfile()
src/backend/features/parent/parent.types.ts        주석: "Never includes raw chat logs"
src/backend/features/parent/parent-settings.store.ts   공개 범위 토글 3종 + hidePrivateChat 고정 true
```
이 파일이 **이미 AI Bridge 역할**을 합니다. 아동 스토어 5곳을 읽어 요약만 내보냅니다.
단, `askParentReport()` 가 **정규식 분기 기반**입니다 (LLM 미사용). STEP 6 승급 대상.

### 미션 추천 (AI Agent 승급 대상)
```
src/backend/features/adventure-quest/adventure-quest.service.ts
  updateAdventureProgress() / attachPhotoToQuest() / latestEmotionSummary() 소비
src/backend/features/adventure-quest/adventure-quest.rules.ts     규칙 기반 팩 생성
src/backend/features/adventure-quest/adventure-story.service.ts   하루 이야기 (LLM)
```

### 저장 계층 (json ↔ dynamodb 스왑 이미 가능)
```
src/backend/shared/persist/map-store.ts            createMapStore(filename, {userIdKey})
src/backend/shared/persist/dynamodb-map-store.ts   pk = MAP#<namespace>, sk = <id>
```
**주의**: 파티션 키가 네임스페이스 고정입니다. 전체 파티션을 훑는 조회가 3곳 있습니다.
```
photo-album.store.listPhotosForUser        values() 후 메모리 filter
guardian-link.store.getActiveInviteForChild
guardian-link.store.countGuardiansForChild
```

### Aurora (STEP 5 제거 대상) — SQL 은 파일 1개뿐
```
src/backend/shared/db/postgres.ts          Pool · query · withClient · isAuroraConfigured
src/backend/features/auth/auth.users.repo.ts   유일한 SQL 파일
  실제 사용 쿼리 3종: findUserByEmail · createUser · deleteUserById
  미사용 export: upsertUser · deleteUserByEmail
src/backend/features/auth/auth.service.ts       isAuroraConfigured() 분기 3곳
src/backend/features/auth/auth.delete.service.ts  분기 1곳
```
테이블 스키마: `users(id, email UNIQUE, name, role CHECK(child|guardian), password_hash, created_at)`
관계형 기능 중 실제로 쓰는 것은 **이메일 UNIQUE 제약 하나**입니다.

### 이미지 생성 (Stability, us-west-2)
```
src/backend/features/persona/avatar.generate.ts
  3단 폴백: style-guide → image-to-image → text-to-image
  번들된 유치원생 크레용 예시 8장을 스타일 참조로 사용
src/backend/features/hospital-day/schedule-image.generate.ts
  모듈 레벨 const generating = new Set<string>()   ← 인메모리 중복 방지 (태스크 2개면 깨짐)
  waitForGeneration: 1.5초 × 40회 = 최대 60초 대기
src/app/api/hospital-day/image/[id]/route.ts   maxDuration = 60
```

### 기타 공통
```
src/backend/shared/config/env.ts     모든 환경변수 진입점
src/backend/shared/http/route.ts     withApiGuard (401/HttpError/500 통일) — 계속 사용
src/middleware.ts                     역할 게이트 (child / guardian 상호 차단)
src/frontend/features/waiting-room/hooks/useLocalWeather.ts
```

### 인프라
ECS Fargate 1 태스크 (1 vCPU / 2 GB) · ALB · CloudFront · DynamoDB `BediApp` · S3 (avatars/ schedule-images/ photos/ src/) · Aurora PostgreSQL
배포: `scripts/aws/04-deploy-ecs-east1.ps1` · Aurora 생성: `scripts/aws/06-aurora-setup.ps1`

---

## 4. TARGET ARCHITECTURE

### 세 개의 AI 능력 — 각각 하나의 책임
```
Amazon Bedrock              자연어 생성만. 무엇을 검색할지 결정하지 않음
AI Agent                    추론과 추천. 무엇을 만들지 결정
Knowledge Bases (Bedrock)   과거 기억 검색. 보호자 인사이트의 근거
```

### AI Orchestrator — 모든 AI 요청의 단일 진입점
```
src/backend/ai/orchestrator.ts     (신규)
src/backend/ai/prompts/            (신규 — 흩어진 프롬프트 통합)
src/backend/ai/agent/              (신규 — 미션 추론)
src/backend/ai/bridge/             (신규 — 보호자 요약 경로)
```
컨트롤러와 React 컴포넌트는 Bedrock 을 직접 호출하지 않습니다.
책임: 용도별 모델 선택 · 프롬프트 조립 · Guardrails 적용 · 계측 · 폴백.

```
아동 대화        → Orchestrator → Bedrock (Haiku, 스트리밍)
감정 분석        → Orchestrator → Bedrock (Haiku, 응답 후)
오늘의 미션      → Orchestrator → AI Agent → Bedrock (Opus, 배치)
보호자 질문      → Orchestrator → AI Bridge → KB 검색 → 프라이버시 필터 → Bedrock (Opus)
스토리북        → Orchestrator → KB 검색 → Bedrock (Opus)
```

### 두 개의 실행 경로 — 가장 중요한 구조
**즉시 경로** — 아이가 화면에서 기다리는 것만. Bedrock 호출 1회로 제한.
**배치 경로** — EventBridge 새벽 실행. 지연 무관이라 큰 모델 사용.

> 요청 시점에 만들지 않습니다. 전날 밤에 만들어 두고 읽습니다.

### 저장소 최종 구성
```
DynamoDB BediApp    사용자 · 페르소나 · 대화 · 메모리 · 감정 · 미션 · 타임라인 · 사진 메타
                    배치가 미리 만든 결과 (오늘의 미션 · 보호자 요약 · 성찰)
S3                  avatars/ · schedule-images/ · photos/ · storybooks/
                    vectors/  ← S3 Vectors (KB 인덱스)
Bedrock KB          S3 의 요약 문서를 색인. 원문 대화는 색인하지 않음
```

---

## 5. STEPS

각 STEP 은 독립 커밋 가능해야 합니다. **완료 조건을 만족하지 못하면 다음 STEP 으로 넘어가지 마세요.**

---

### STEP 0 — 되돌릴 수 있게 만들기

1. `git init`
2. `.gitignore` 확인 — `.env*.local`, `/.data/`, `/.next/`, `node_modules` 제외 확인
3. 첫 커밋

**완료 조건**: `git log` 에 커밋 1개. `git status` 출력에 `.env.local` 이 없음.

---

### STEP 1 — 즉시 경로 속도 (최우선, 체감 개선의 대부분)

1. **모델 라우팅 분리** — `src/backend/shared/config/env.ts`
   - `BEDROCK_MODEL_ID_CHAT` (기본값: Haiku 계열)
   - `BEDROCK_MODEL_ID_QUALITY` (기본값: 현재 `BEDROCK_MODEL_ID` 값)
   - 기존 `BEDROCK_MODEL_ID` 는 하위 호환으로 유지
   - 현재 `.env.local` 이 대화에 Opus 4.6 을 쓰고 있습니다. 최상위 티어라 첫 토큰이 가장 느립니다.

2. **`src/backend/ai/orchestrator.ts` 최소 버전 생성**
   - 이번 STEP 에서는 **대화 경로만** 통과시킵니다. 나머지는 기존 호출을 그대로 두세요 (점진 이관).
   - 용도(`chat` / `analysis` / `quality`)에 따라 모델을 고르는 함수 하나로 시작

3. **SSE `done` 을 분석 호출과 분리** — `conversation.service.ts`
   - `streamMessage()` 가 `done` 을 yield **한 뒤** 저장·분석을 시작
   - ECS 는 응답 후에도 프로세스가 살아 있어 가능합니다
   - 단, 실패를 삼키지 말고 로그를 남기세요 (STEP 2 에서 계측으로 승급)

4. **`ChildContextService` 신설** — 아동 컨텍스트 집계 전용
   - `resolveCompanionContext()` 의 순차 `await` 4개(persona → history → memory → wishes)를 `Promise.all` 로
   - 같은 아이에 대한 반복 조회를 이 서비스로 모읍니다

5. **작업 전후 응답 시간을 측정해 기록** — 발표 자료에 쓸 숫자입니다

**완료 조건**: 대화 정상 동작 · 첫 토큰까지 시간 개선 · `tsc` 통과 · 측정값 기록 완료

---

### STEP 2 — 계측 (이후 모든 최적화의 근거)

1. 구조화 로깅 유틸 — `src/backend/shared/observability/`
   - 필드: `feature`, `model`, `latencyMs`, `inputTokens`, `outputTokens`, `success`, `requestId`
2. Orchestrator 에서 Bedrock 호출을 감싸 **CloudWatch 커스텀 메트릭** 발행
   - Bedrock 지연 · AI Agent 실행 시간 · KB 검색 시간 · 토큰 사용량 · 오류율 · DynamoDB 지연
3. 대시보드 1개 + 알람 2개 (LLM 실패율, p95 지연)
4. `console.warn` 으로 예외를 삼키는 지점을 계측으로 승급
   - 우선순위: `schedule-image.store.ts`, `avatar.store.ts` 의 S3 쓰기 실패

**완료 조건**: CloudWatch 에서 기능별 지연이 보임 · STEP 1 개선폭을 숫자로 제시 가능

---

### STEP 3 — Orchestrator 완성 + 프롬프트 통합 + Guardrails

1. **Bedrock Guardrail 생성**
   - 거부 토픽: 의료 진단 · 처방 · 검사 수치 해석
   - 자해 · 위기 발화 감지 경로
   - PII 마스킹
2. Orchestrator 의 **모든** Converse 호출에 guardrail 적용 (한 곳에서)
3. 흩어진 시스템 프롬프트를 `src/backend/ai/prompts/` 로 통합
   - 공통 안전 규칙을 **단일 상수**로 추출해 모든 프롬프트가 참조
   - 기존 프롬프트 문구를 임의로 바꾸지 마세요. 위치만 옮기고 중복만 제거
4. 남은 직접 호출(`getLlmProvider()` 을 쓰는 서비스들)을 Orchestrator 경유로 이관

**완료 조건**: 안전 규칙이 한 파일에만 존재 · 컨트롤러에서 Bedrock 직접 호출 0건 · 기존 응답 품질 유지

---

### STEP 4 — 배치 경로 (EventBridge + AI Agent + 메모리 2층)

1. `/api/cron/*` 라우트 신설. 공유 시크릿 헤더로 보호 (`CRON_SECRET`)
2. **EventBridge Rule → API Destination → `/api/cron/*`** (새벽 스케줄)
   - Lambda 를 새로 만들지 않습니다. 지금 컨테이너가 처리합니다
   - 실패 시 CloudWatch 알람

3. **배치 잡 3종**

   **잡 1 · 메모리 통합** (이 STEP 의 최대 성과)
   - 하루치 대화를 Opus 로 한 번에 읽어 메모리를 재작성
   - `memory.service.learnFromTurn` 의 **매 턴 LLM 호출을 제거**하고 이 배치로 대체
   - 속도(요청 경로에서 1콜 제거) · 품질(더 큰 모델, 더 넓은 문맥) · 비용이 동시에 개선됩니다

   **잡 2 · 오늘의 미션 사전 생성** — AI Agent
   - Agent 가 입력을 모아 추론한 뒤 Bedrock 에 생성 요청
   - 입력: 감정 이력 · 병원 일정 · 최근 기억 · 관심사 · 이전 미션 · 보호자 노트 · 날씨
   - 입력 수집은 `Promise.all` 로 병렬
   - 결과를 DynamoDB 에 저장. 삽화까지 미리 생성
   - **날씨 입력 처리 (결정됨)**
     - 브라우저가 위치 권한으로 좌표를 얻으면 **소수점 1자리로 반올림**해 서버로 전송하고, 서버가 coarse 위치를 저장합니다. 정확한 좌표는 저장하지 않습니다 (날씨는 도시 단위면 충분)
     - **날씨 조회를 서버로 이관**하세요. 현재 `useLocalWeather` 훅이 브라우저에서 외부 도메인 2곳(Open-Meteo, BigDataCloud)에 직접 호출합니다. 서버로 옮기면 제3자가 아이 기기 대신 ECS 송신 IP 를 보게 되고, coarse 위치 단위로 30~60분 캐싱이 가능하며, 배치가 같은 경로를 재사용합니다
     - **배치는 현재 날씨가 아니라 오늘 예보를 조회하세요.** 새벽에 도는 배치가 `current` 를 쓰면 아이가 오전에 보는 날씨와 어긋납니다. Open-Meteo 의 일일 예보 파라미터로 바꾸세요
     - coarse 위치에 **DynamoDB TTL** 을 걸어 며칠 후 자동 만료시키고, 만료 시 병원 지역 기본값으로 폴백합니다
     - 위치 저장을 시작하므로 **동의 문구를 추가**하세요. `src/frontend/features/auth/lib/legal-copy.ts` 와 `LegalDocumentModal.tsx` 에 자리가 있습니다
     - **위치는 AI Bridge 를 건너가지 않습니다.** 보호자 요약에 "비 오는 날이었어요" 는 가능하지만 좌표·지역명은 전달 금지

   **잡 3 · 보호자 요약 · 하루 성찰 사전 생성**
   - 아침에 보호자가 홈을 열면 이미 만들어져 있어야 합니다

4. **메모리를 2층으로**
   ```
   휘발성   최근 어투 · 감정 테마        상한 있음 · 매일 갱신
   영속     중요한 사실                 상한 없음 · 중요도 점수
            "누나가 화요일마다 온다" · "주사를 무서워한다"
   ```
5. **컨텍스트 주입 최적화** — 메모리 전부가 아니라 현재 메시지와 **키워드 겹침 + 최근성 상위 N개**만

**완료 조건**: 배치 수동 트리거로 결과 생성 확인 · 즉시 경로는 저장된 결과를 읽기만 · 대화 턴당 Bedrock 호출이 1회(+응답 후 1회)로 감소

---

### STEP 5 — 보안 + Aurora 제거

**5-1. 즉시 (10분, 최우선)**
- Aurora 보안 그룹에서 `0.0.0.0/0` 인그레스 회수 + `publicly-accessible` 해제
- 현재 아동 자격 증명이 담긴 DB 가 인터넷에 열려 있습니다

**5-2. TaskRole S3 권한 수정 (프로덕션 버그)**
- `avatars/*` → `avatars/*`, `schedule-images/*`, `photos/*`
- `photo-album.store.savePhotoBytes` 가 `PutObject` 를 `try` 없이 호출합니다. 지금 프로덕션에서 사진 업로드가 실패합니다
- 대상: `scripts/aws/02-iam-apprunner-role.ps1`, `scripts/aws/04-deploy-ecs-east1.ps1`

**5-3. 시크릿 이관**
- `OPENAI_API_KEY`, `AUTH_SESSION_SECRET`, `PGPASSWORD` → Secrets Manager
- `04-deploy-ecs-east1.ps1` 의 태스크 정의를 `environment` → `secrets` 참조로 변경
- 태스크 정의는 조회 권한만 있으면 누구나 읽습니다

**5-4. 인증을 DynamoDB 로 이관**
```
아이템 1   pk = USER#<userId>          sk = PROFILE
                                       email, name, role, passwordHash, createdAt
아이템 2   pk = EMAIL#<소문자 이메일>   sk = UNIQUE
                                       userId
```
- 가입: `TransactWriteItems` 로 두 아이템 함께 Put. `EMAIL#` 에 `attribute_not_exists(pk)` 조건 → SQL UNIQUE 와 동일한 보장
- 로그인: `EMAIL#` GetItem → userId → 프로필 조회
- 삭제: `TransactWriteItems` 로 두 아이템 함께 Delete
- 중복 이메일: PostgreSQL `23505` 처리 자리를 `TransactionCanceledException` 처리로 교체
- **함정**: 기존 `createMapStore` 를 쓰지 마세요. `pk = MAP#<ns>` 고정이라 이메일 조회에 파티션 전체 Query 가 필요해집니다. `DocumentClient` 로 직접 쓰는 전용 리포지토리를 만드세요
- `env.ts` 의 `authProvider` 기본값을 `"auto"` → 명시값으로. `auto` 는 Aurora 미설정 시 조용히 `MOCK_USERS` 로 넘어갑니다
- 프로덕션에서 mock 폴백 차단 (`auth.session.ts` 가 `AUTH_SESSION_SECRET` 에 대해 이미 같은 패턴을 씁니다)
- 데모 계정 6개 비밀번호 교체 (`scripts/seed-aurora-users.js`, `scripts/wipe-fresh-start.js`)

**5-5. Aurora 정리**
- `src/backend/shared/db/postgres.ts` 삭제
- `pg`, `@types/pg` 의존성 제거 · `seed:aurora` 스크립트 정리
- `scripts/aws/06-aurora-setup.ps1` 폐기
- `04-deploy-ecs-east1.ps1` 에서 `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`/`PGSSL` 주입 제거
- Aurora 클러스터 삭제는 **데모 이후에** 하세요. 롤백 여지를 남깁니다

**완료 조건**: 로그인·회원가입·계정삭제 정상 · DB 가 인터넷에서 접근 불가 · 태스크 정의에 평문 시크릿 없음 · 사진 업로드 성공 · `pg` 의존성 제거

---

### STEP 6 — AI Bridge 승급 + Knowledge Bases (S3 Vectors)

1. **KB 생성** — 벡터 스토어는 **S3 Vectors**
   - 새 클러스터를 띄우지 않고 기존 S3 에 벡터 인덱스를 둡니다
   - Aurora 를 제거했으므로 pgvector 는 선택지가 아닙니다
   - OpenSearch Serverless 는 사용하지 않습니다 (유휴 비용)

2. **색인 대상 — 요약만**
   ```
   대화 요약 · 감정 이력 · 타임라인 · 미션 이력 · 중요 기억 · 보호자 관찰 · 아동 관심사
   ```
   - **대화 원문은 색인하지 않습니다.** 검색으로 원문이 새어 나가면 AI Bridge 원칙이 깨집니다
   - 배치(STEP 4)가 만든 요약 문서를 S3 에 쓰고 KB 가 그걸 읽는 흐름

3. **`askParentReport()` 승급** — `src/backend/features/parent/parent.service.ts`
   - 현재: 정규식으로 질문 의도를 분기해 문장을 조립
   - 이후: KB 검색 → 프라이버시 필터 → Bedrock(Opus) 요약
   - 근거(출처) 표기는 지금도 있으니 유지하세요

4. **스토리북 생성**도 KB 검색을 경유하도록

**완료 조건**: 보호자 질문에 근거 있는 답변 · 응답에 대화 원문이 없음 · KB 검색 시간이 CloudWatch 에 기록됨

> 시간이 부족하면 **이 STEP 을 버리고 STEP 1·4·5 를 지키세요.** KB 없이도 아키텍처 서사는 성립합니다.

---

### STEP 7 — 검증 · 발표 준비

1. 전체 시나리오 리허설 (아동 온보딩 → 대화 → 미션 → 사진 → 보호자 연결 → 요약 → 리포트)
2. STEP 1 전후 성능 숫자 정리
3. 다이어그램 갱신 — `docs/architecture-target.svg` 를 최종 상태로
4. 남은 목·임시 구현 목록 정리

---

## 6. DO NOT DO

- **Cognito 도입 금지.** 미들웨어 JWT 검증까지 다시 써야 하고 데모 직전 로그인이 깨질 위험이 큽니다
- **OpenSearch 직접 구축 금지.** RAG 는 Knowledge Bases + S3 Vectors 로만
- **SQS 워커 분리 금지.** 태스크가 1개라 현재 fire-and-forget 이 동작합니다. 한계를 문서에 기록만 하세요
- **음성 녹음 · 그림 그리기 기능을 만들지 마세요.** 코드에 없습니다. 사진 업로드만 존재합니다
- **`pk = MAP#<namespace>` 키 설계를 바꾸지 마세요.** 이번 범위가 아닙니다 (STEP 5-4 의 인증만 예외)
- **새 UI 컴포넌트를 만들지 마세요.** 로딩·빈 상태·에러 상태 개선은 기존 컴포넌트 안에서만
- **DI 컨테이너 도입 금지**
- ECS 태스크 스펙을 올려서 속도를 해결하려 하지 마세요. 병목은 Bedrock 호출입니다 (STEP 2 로 확인)

---

## 7. 구현 전에 질문할 것

1. **AI Agent 의 날씨 입력을 어디서 가져올지.**
   현재 날씨는 `useLocalWeather` 훅이 **브라우저에서** geolocation 으로 가져옵니다. 새벽 배치에는 브라우저가 없습니다.
   마지막 위치를 저장할지, 병원 지역 기본값을 쓸지 결정이 필요합니다.
   (참고: 아동 기기 좌표가 현재 AWS 를 거치지 않고 외부 도메인 2곳으로 직접 전송됩니다. 아동 앱에서 검토가 필요한 사안입니다.)
2. **Guardrails 의 자해·위기 발화 처리 경로.** 차단만 할지 보호자 알림까지 연결할지는 제품 결정입니다.
3. **배치 실행 시각.** 아이 생활 리듬에 맞춰야 합니다.

---

## 8. CODING RULES

```
Controllers (src/app/api/**)  →  Services  →  Repositories  →  AWS
```
- 컨트롤러는 서비스만 호출. 비즈니스 로직 금지
- 서비스는 리포지토리를 통해서만 저장소 접근
- AWS SDK 사용은 `shared/persist`, `shared/llm`, `ai/` 안에만 격리
- React 컴포넌트에 비즈니스 로직·AI 로직 금지
- `withApiGuard` 계속 사용
- 예외를 조용히 삼키지 마세요. 삼켜야 한다면 계측을 남기세요
- SOLID · DRY · KISS · 단일 책임
- 기존 파일의 스타일·명명 규칙을 따르세요

## 9. VERIFICATION

각 STEP 종료 시:
```bash
npx tsc --noEmit      # 반드시 통과
npm run lint
npm run build         # STEP 종료 시 최소 1회
```
`npm run dev` 는 직접 백그라운드로 띄우지 말고 사용자에게 실행을 요청하세요.

## 10. OUTPUT FORMAT — 각 변경마다

1. **Current Implementation** — 바꾸기 전 상태
2. **AWS Service Used**
3. **Reason** — 왜 그 서비스인가 (한 문장)
4. **Data Flow** — 변경 전 → 변경 후
5. **Files Modified** — 실제 경로
6. **Remaining Mock Implementations**
7. **Risks**
8. **Future Improvements**

STEP 종료 시 위 8항목으로 요약하고 커밋 메시지를 제안하세요.
