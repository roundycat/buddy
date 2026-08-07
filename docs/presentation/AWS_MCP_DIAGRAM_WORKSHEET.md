# AWS MCP 다이어그램 실사용 워크시트

이 문서는 발표 직전에 **실제 값**을 채워 넣어 다이어그램/발표본을 최신 상태로 맞추기 위한 체크리스트다.

---

## 0) 기본 정보

- [ ] 기준 일시: `YYYY-MM-DD HH:mm KST`
- [ ] 작업자:
- [ ] 대상 환경: `prod | staging`
- [ ] AWS Account ID:
- [ ] Region:

---

## 1) 리소스 실값 입력표

### 네트워크 / 런타임

| 항목 | 실제 값 | 확인 |
|---|---|---|
| ALB 이름 |  | [ ] |
| ALB DNS |  | [ ] |
| Listener 포트 (80/443) |  | [ ] |
| Target Group 이름 |  | [ ] |
| ECS Cluster |  | [ ] |
| ECS Service |  | [ ] |
| Task Definition (family:revision) |  | [ ] |
| Desired / Running Count |  | [ ] |
| ECR Repository |  | [ ] |
| Latest Image Tag/Digest |  | [ ] |

### 데이터 / 스토리지

| 항목 | 실제 값 | 확인 |
|---|---|---|
| DynamoDB Table |  | [ ] |
| DynamoDB Key (pk/sk) |  | [ ] |
| DynamoDB TTL 속성 |  | [ ] |
| S3 Bucket (main) |  | [ ] |
| S3 Prefix: `kb-summaries/` |  | [ ] |
| S3 Prefix: media (`photos/`, `diary/` 등) |  | [ ] |

### AI / 배치 / 운영

| 항목 | 실제 값 | 확인 |
|---|---|---|
| Bedrock Chat Model ID |  | [ ] |
| Bedrock Quality Model ID |  | [ ] |
| Bedrock Image Model ID |  | [ ] |
| Guardrail ID / Version |  | [ ] |
| Knowledge Base ID |  | [ ] |
| KB Data Source S3 경로 |  | [ ] |
| EventBridge Rule 이름 |  | [ ] |
| EventBridge Cron |  | [ ] |
| EventBridge Target URL(`/api/cron/daily`) |  | [ ] |
| CloudWatch Log Group |  | [ ] |
| CloudWatch Dashboard |  | [ ] |
| 핵심 Alarm 이름 |  | [ ] |
| Secrets Manager Secret 이름 |  | [ ] |

---

## 2) 플로우 검증 체크리스트

### LLM 경로 (실시간)
- [ ] `Browser -> ALB -> ECS -> Bedrock(Converse+Guardrails) -> ECS -> UI` 반영
- [ ] 채팅은 Agent가 아니라 LLM 경로임을 표기
- [ ] 저장 위치(DynamoDB/S3) 표기

### Agent 경로 (새벽 미션)
- [ ] EventBridge 트리거로 동작(상시 아님) 표기
- [ ] Mission Agent 도구 참조 2종 표기:
  - [ ] `emotional-guidance.cards.json`
  - [ ] 최근 모험 제목(중복 방지)
- [ ] generate/validate/repair/fallback 흐름 표기

### RAG 경로 (보호자 질문)
- [ ] `질문 -> query rewrite -> KB retrieve -> bridge filter -> answer` 표기
- [ ] KB summary 문서 5종 표기:
  - [ ] memory
  - [ ] emotion
  - [ ] mission
  - [ ] timeline
  - [ ] interests
- [ ] 경로 `kb-summaries/{childId}/...` 표기

### 프라이버시 경계
- [ ] raw chat 직접 전달 금지 점선/차단 표기
- [ ] diary raw / GPS / 타 아동 데이터 차단 표기
- [ ] `Parent receives summaries only` 문구 반영

---

## 3) 다이어그램 출력 체크

- [ ] `docs/aws-live-architecture.svg/png` 갱신
- [ ] `docs/aws-live-app-flow.svg/png` 갱신
- [ ] `docs/aws-live-dataflow.svg/png` 갱신
- [ ] 슬라이드 삽입본 교체 완료
- [ ] 폰트/가독성(프로젝터) 확인

---

## 4) 발표 직전 30초 점검

- [ ] ALB URL 접속 확인
- [ ] Child/Guardian 로그인 확인
- [ ] `LLM_FALLBACK_TO_MOCK=false` 확인
- [ ] EventBridge cron 최신 상태 확인
- [ ] KB/Guardrail ID 최신 상태 확인

---

## 5) 30초 발표 멘트(복붙용)

`입원 중에는 LLM이 아이와 실시간 상호작용하고, 새벽에는 Agent가 다음날 미션을 준비합니다. 보호자 질문은 RAG가 요약 문서 5종과 당일 집계를 바탕으로 답하며, 원문 채팅·일기·GPS는 직접 전달되지 않습니다.`

