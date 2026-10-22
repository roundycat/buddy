# STEP 7 — 검증 · 발표 준비

프로덕션: `https://d36nmab92hbhe2.cloudfront.net`  
태스크: `bedi-app:16` (STEP 6 KB 포함) · 리전 `us-east-1`

---

## 1. 데모 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 아동 | `demo@bedi.app` | `(v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정)` |
| 보호자 | `guardian@bedi.app` | `(v1 해커톤 비밀번호 — 폐기됨, 배포 시 환경 변수로 새로 설정)` |

시드: `npm run seed:dynamo` (로컬/필요 시). 프로덕션은 이미 DynamoDB 시드 가정.

**확인:** ECS env `AUTH_PROVIDER=dynamodb`, `LLM_PROVIDER=bedrock`, `BEDROCK_KB_ID=GREBZFCNYP`

---

## 2. 시나리오 리허설 체크리스트

| # | 단계 | 확인 |
|---|------|------|
| 1 | 아동 로그인 → 온보딩/페르소나 | 비밀친구·아바타 |
| 2 | 대기실 대화 (짧게 2~3턴) | SSE 스트리밍 · 입력 빨리 풀림 |
| 3 | 오늘의 모험 / 미션 | 배치 사전생성 또는 첫 오픈 생성 |
| 4 | 감정 정원 · 사진 업로드 | S3 `photos/` |
| 5 | 보호자 초대/연결 | 링크 코드 |
| 6 | 보호자 홈 | 요약·공감 가이드 (원문 대화 없음) |
| 7 | 보호자 리포트 질문 | KB 근거 라벨 · 원문 미노출 |
| 8 | (선택) 스토리북 봉인 | KB 하이라이트 경유 |

**수동 cron 스모크 (선택):**
```bash
curl -X POST "https://d36nmab92hbhe2.cloudfront.net/api/cron/daily" \
  -H "x-bedi-cron-secret: $CRON_SECRET"
```

---

## 3. STEP 1 성능 숫자 (발표용)

출처: `docs/aws/step1-latency.md` (로컬 Bedrock `us-east-1`, 2026-08-05)

| | 모델 | First token |
|--|------|-------------|
| 이전 | Opus (chat 경로) | **2139 ms** |
| 이후 | Haiku (`BEDROCK_MODEL_ID_CHAT`) | **1413 ms** |

**Δ −726 ms (−34%)**

구조 개선(체감에 더 큼):
- SSE `done`을 persist/분석 전에 전송 → 입력창 조기 해제
- 컨텍스트 `Promise.all`
- 턴당 메모리 LLM 제거 → 새벽 배치(Opus)로 이동

재측정: `node --env-file=.env.local scripts/bench-step1.mjs`

운영 대시보드: CloudWatch `Beddy-Observability` · 알람 `Beddy-LlmErrorRate` / `Beddy-LlmLatencyP95` / `Beddy-CronDailyFailures`

---

## 4. 아키텍처 한 줄

```
즉시: 아이 메시지 → 병렬 컨텍스트 → Guardrail → Haiku stream → done → (뒤) 저장·감정
배치: EventBridge 05:00 KST → /api/cron/daily → 메모리·미션·보호자·KB 요약 S3
보호자: AI Bridge → KB(S3 Vectors) → 프라이버시 필터 → Opus
```

다이어그램: `docs/architecture-target.svg` (최종) · `docs/architecture-simple.svg` (한 장)

---

## 5. 남은 목 · 임시 · 의도적 한계

### 데모 전 Must-know
- `LLM_FALLBACK_TO_MOCK=true` — Bedrock 실패 시 규칙 답으로 보일 수 있음
- `AUTH_PROVIDER=mock` 은 프로덕션 차단 · 데모는 DynamoDB 계정만
- Guardrail 위기 발화: **차단 + 지지 메시지**만 (보호자 자동 알림 없음)

### Known limitations (의도적)
- 단일 ECS 태스크 · persist/이미지 **fire-and-forget** (SQS 워커 없음)
- 보호자 리포트 LLM 실패 시 regex 템플릿 폴백
- 날씨 API 실패 시 해시 폴백 · 위치 없으면 병원 기본 좌표
- Aurora 클러스터는 롤백용 잔존 (데모 후 삭제) · 로그인 기본은 DynamoDB
- Cognito / OpenSearch **도입 안 함**

### 발표에서 빼도 됨
- 로컬 JSON persist · DevJumpButtons · `pg` 의존성(롤백용) · 헤더 TODO 주석

---

## 6. STEP 완료 맵

| STEP | 커밋/산출 | 상태 |
|------|-----------|------|
| 0 | baseline | ✅ |
| 1 | Haiku + SSE | ✅ · −34% TTFT |
| 2 | CloudWatch | ✅ |
| 3 | Guardrail `opr7cxjd4txo` | ✅ |
| 4 | EventBridge + 배치 | ✅ |
| 5 | 보안·Dynamo auth | ✅ (Aurora 삭제 defer) |
| 6 | KB `GREBZFCNYP` | ✅ |
| 7 | 본 문서 · 다이어그램 | ✅ |
