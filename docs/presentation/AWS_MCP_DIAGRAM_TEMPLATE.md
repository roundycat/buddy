# AWS MCP 다이어그램 템플릿

목적: AWS MCP로 **실제 리소스**를 읽어, 발표용 아키텍처/플로우 다이어그램을 빠르게 갱신한다.

---

## 1) 산출물

- `docs/aws-live-architecture.svg`  
  - 인프라 중심 (ALB/ECS/DynamoDB/S3/Bedrock/EventBridge 등)
- `docs/aws-live-app-flow.svg`  
  - 입원 -> 퇴원 기능 흐름 + LLM/Agent/RAG
- `docs/aws-live-dataflow.svg`  
  - 환아 데이터 가공/전달 경로 + 차단 경로
- PNG 동시 생성:
  - `docs/aws-live-architecture.png`
  - `docs/aws-live-app-flow.png`
  - `docs/aws-live-dataflow.png`

---

## 2) MCP에서 수집할 항목

### 네트워크/런타임
- ALB: 이름, DNS, listener(80/443), target group
- ECS: cluster/service/task definition(revision), desired/running
- ECR: repository, latest image tag

### 데이터/스토리지
- DynamoDB: table, key(pk/sk), ttl
- S3: bucket, 주요 prefix (`kb-summaries/`, `photos/`, `storybook-*`)

### AI
- Bedrock model IDs (chat/quality/image)
- Guardrail ID/version
- Knowledge Base ID + data source(S3 경로)

### 배치/운영
- EventBridge rule + cron + target(`/api/cron/daily`)
- CloudWatch log group / dashboard / alarms
- Secrets Manager secret name

---

## 3) 플로우 매핑 규칙

### LLM (실시간)
`Browser -> ALB -> ECS -> Bedrock(Converse+Guardrails) -> ECS -> UI`

### Agent (새벽 미션)
`EventBridge -> ECS(/cron) -> Mission Agent(tool-use) -> DynamoDB/S3`

### RAG (보호자 질문)
`Parent UI -> ECS -> query rewrite -> KB retrieve(S3 kb-summaries/*) -> bridge filter -> answer`

### 차단 경로(빨간 점선)
`raw chat / diary raw / GPS -> Parent UI` 직접 전달 금지

---

## 4) 다이어그램 표기 규칙

- 박스 1개 = 역할 1개
- 태그 고정: `LLM`, `AGENT`, `RAG`
- 각 박스 문구 2줄 이내
- 리소스명은 실제 값 그대로 표기(예: `bedi-service`, `BediApp`)
- 하단 고정 문구:
  - `Parent receives summaries only.`
  - `Raw chat/diary/GPS never sent directly.`

---

## 5) 발표 전 검증 체크리스트

- [ ] ALB DNS, listener 정보 최신
- [ ] ECS task definition revision 최신
- [ ] Bedrock model/guardrail/KB ID 최신
- [ ] EventBridge cron 시간(KST 환산) 확인
- [ ] RAG 문서 경로(S3 prefix) 실제와 일치
- [ ] 차단 경로(원문/GPS) 다이어그램에 명시

---

## 6) 30초 발표 스크립트

`입원 중에는 LLM이 아이와 실시간 상호작용하고, 새벽에는 Agent가 다음날 미션을 준비합니다. 보호자 질문은 RAG가 요약 문서와 당일 집계를 바탕으로 답하며, 원문 채팅과 민감정보는 직접 전달되지 않습니다.`

