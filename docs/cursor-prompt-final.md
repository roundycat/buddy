# Cursor 실행 프롬프트 — Bedrock Tool Use 기반 미션 Agent (근거 검색 도구 포함)

> 이 문서 하나로 실행 가능하다. `cursor-prompt-agent.md` 와 `cursor-prompt-tool-agent.md` 와 `cursor-prompt-evidence-tool.md` 는 이 문서로 대체된다. 참고 데이터는 `docs/care-evidence-cards.json` 하나뿐이다.

---

## 0. 배경과 목표

외부 피드백: **"오케스트레이터는 슈퍼바이저가 아니다. Agent인지 RAG인지 명확히 명시되어야 한다. @tool 같은 걸 써서 Agent 형식으로 동작하기를 원한다."**

현재 코드에 `toolConfig`, `toolUse`, `toolSpec` 이 **0건**이다. `ConverseCommand` 에 넘기는 건 `modelId`, `system`, `messages`, `inferenceConfig`, `guardrailConfig` 뿐이다. 코드가 데이터를 다 모아 `JSON.stringify` 로 프롬프트에 붙이고 LLM을 1회 부르는 구조다. 이것은 Agent가 아니다.

이 작업이 끝나면 다음이 코드로 증명된다.

- `toolConfig` 를 Bedrock에 전달한다
- `stopReason: "tool_use"` 를 수신한다
- LLM이 요청한 도구를 실제로 실행하고 `toolResult` 를 대화에 다시 넣는다 (루프)
- **무엇을 조회할지 LLM이 결정한다.** 아이 상황에 따라 호출하는 도구와 인자가 달라진다
- 도구 중 하나가 **논문 근거 검색**이다. 미션에 출처가 붙는다

대상은 **오늘의 미션**이다. 새벽 배치 경로라 지연 제약이 없다. 툴 루프는 Bedrock 호출이 3~6회로 늘어나므로 실시간 경로에 넣을 수 없다.

### 최종 분류 — 이 표가 결과물이다

| 구성요소 | 분류 | 파일 |
|---|---|---|
| 아이 대화 | **LLM 직접 호출** (Agent 아님, RAG 아님) | `features/conversation/*` |
| 오늘의 미션 | **AI Agent (Bedrock Tool Use)** | `ai/agent/mission-agent.ts` |
| 보호자 인사이트 | **RAG** | `ai/kb/retrieve.ts` + `parent.service.ts` |
| 근거 카드 검색 | Agent의 도구 (RAG 아님, 결정론적 필터) | `ai/evidence/*` |
| 프라이버시 필터 | 데이터 경계 (AI 아님) | `ai/bridge/privacy-filter.ts` |
| 모델 라우팅·Guardrails·계측 | 배관 (AI 아님) | `ai/orchestrator.ts` |

---

## 1. 절대 금지

- **아이 대화 즉시 경로(`streamCompanionChat`)에 도구를 붙이지 말 것.** 대화는 Bedrock 1회 호출 + SSE 스트리밍을 유지한다. 첫 토큰까지의 시간이 이 프로젝트의 핵심 지표다. 여기에 툴 루프가 들어가면 작업 실패로 간주한다.
- **기존 폴백을 삭제하지 말 것.** `buildRuleBasedPack()`, `tryGenerateWithLlm()`, `resolveScene()`, `buildFactorChips()`, `normalizeQuestKind()`, `isQuestReadyToClaim()`, `env.llmProvider === "mock"` 조기 반환, `LLM_FALLBACK_TO_MOCK` 동작 전부 유지.
- **`getAdventureQuest()`, `updateAdventureProgress()`, `ensureTodayPack()`, `attachPhotoToQuest()` 를 건드리지 말 것.** UI가 쓰는 조회·진행 경로다.
- **API 응답에서 필드를 제거하거나 이름을 바꾸지 말 것.** 추가만 허용한다.
- **중앙 디스패처를 만들지 말 것.** 요청을 받아 어느 능력이 처리할지 결정하는 계층을 추가하면 오케스트레이터가 이름만 바뀐 채 되살아난다.
- **`orchestrator` / `supervisor` 라는 단어를 새로 쓰지 말 것.** 기존 `ai/orchestrator.ts` 파일명은 이번 작업에서 건드리지 않는다.
- **근거 카드 검색을 RAG라고 부르지 말 것.** 벡터 검색이 아니라 21개 카드에 대한 결정론적 필터링이다. `ai/rag/` 아래 두지 말고 `ai/evidence/` 아래 둔다.
- **DI 컨테이너 도입 금지.** 모듈 레벨 함수 구조 유지.
- **무한 루프 금지.** 반복 상한과 시간 예산을 둘 다 강제한다.
- **Aurora / `pg` / `shared/db/postgres.ts` 미접촉.**
- **새 npm 패키지 추가 금지.** `@aws-sdk/client-bedrock-runtime` 에 필요한 타입이 다 있다.

---

## 2. 현재 코드 사실 (추측하지 말고 이 값을 쓸 것)

```
LLM 게이트웨이     backend/ai/orchestrator.ts
  runLlm({ feature, purpose, messages, temperature, maxTokens, applyGuardrail? })
  resolveModelForPurpose("chat" | "analysis" | "quality")
  observeKbSearch(feature, fn)
  purpose chat/analysis → env.bedrock.chatModelId    (Haiku 4.5)
  purpose quality       → env.bedrock.qualityModelId (Opus 4.6)

프로바이더         backend/shared/llm/providers/bedrock.provider.ts
  class BedrockLlmProvider implements LlmProvider
  private buildPayload(request)               ← chat/chatStream 공용, 수정 금지
  function resolveGuardrail(request)          ← 파일 하단 모듈 함수

프로바이더 진입점   backend/shared/llm/index.ts
  getLlmProvider()   ← 캐시된 싱글턴 반환

타입               backend/shared/llm/types.ts
  LlmMessage { role: "system"|"user"|"assistant"; content: string }
  LlmChatRequest { messages, temperature?, maxTokens?, model?, guardrail? }
  LlmProvider { name; chat(); chatStream?() }

미션 서비스        backend/features/adventure-quest/adventure-quest.service.ts
  buildContext(userId, date)                  → 7종 Promise.all
  tryGenerateWithLlm(userId, date, context, scene)
  prepareAdventurePackForDate(userId, date)   ← 배치 + 첫 조회 진입점
  fetchAdventureWeather(userId, date)         → { code, label, emoji } 만 반환

규칙               backend/features/adventure-quest/adventure-quest.rules.ts
  buildRuleBasedPack(userId, date, scene, context)
  buildFactorChips(context, scene)
  resolveScene(context)      ← treatment > low_energy > rainy > sunny 우선순위
  normalizeQuestKind(raw, title, hint)

스토어             backend/features/adventure-quest/adventure-quest.store.ts
  getAdventurePack(userId, date)
  saveAdventurePack(pack)
  listAdventurePacksForUser(userId)

타입               backend/features/adventure-quest/adventure-quest.types.ts
  AdventureScene     = "sunny" | "rainy" | "treatment" | "low_energy"
  AdventureQuestKind = "photo" | "garden" | "chat" | "post" | "observe"
  AdventureDayPack { userId, date, scene, headline, companionNote,
                     factors, context, quests, generatedBy, dayStory? }
  generatedBy: "rules" | "llm"

계측               backend/shared/observability/index.ts
  observeAsync({ feature, operation?, model?, requestId?, latencyMetric? }, fn)
  observeFailure({ ... })
  putBeddyMetrics([{ name, value, unit, feature, model, operation }])
  recordCount(name, value, { feature, operation })
  recordLatency(name, value, { feature, operation })
  logObservation(fields)   newRequestId()

도구가 쓸 기존 함수 (전부 이미 존재)
  getPersonaForUser(userId)          features/persona/persona.store
  getHospitalDay(userId)             features/hospital-day/hospital-day.service
  getGardenAccount(userId)           features/emotion-garden/emotion-garden.store
  getConversationMemory(userId)      features/conversation/conversation.store
  countGuardiansForChild(userId)     features/guardian-link/guardian-link.store
  latestEmotionSummary(userId)       features/emotion-analysis/emotion.service
  getWeatherForUser(userId, dateKey) features/weather/weather.service
  listAdventurePacksForUser(userId)  features/adventure-quest/adventure-quest.store
  MOOD_OPTIONS                       features/emotion-garden/emotion-garden.service
  withBeddySafety(system)            ai/prompts/safety
  extractJsonObject(text)            shared/llm/parse-json
  todayKey()                         shared/time/date
```

### 이미 적용되어 있을 수 있는 부분

`src/backend/shared/llm/types.ts` 와 `src/backend/shared/llm/providers/bedrock.provider.ts` 에 STEP 1·2가 반영된 상태일 수 있다. `git status` 로 먼저 확인할 것.

- 변경이 있으면 `npx tsc --noEmit` 을 돌려 검증한 뒤 STEP 3으로 넘어간다
- 없으면 STEP 1부터 시작한다

---

## STEP 1 — LLM 타입에 Tool Use 계약 추가

**파일:** `src/backend/shared/llm/types.ts` (기존 export 전부 유지, 아래를 추가)

기존 `LlmChatRequest` / `LlmChatResult` 를 확장하지 말 것. `content: string` 인 단순 계약을 쓰는 호출부가 13곳이다. 툴은 **별도 계약**으로 분리한다.

```ts
/** 모델이 호출할 수 있는 도구 하나. inputSchema 는 JSON Schema 객체. */
export interface LlmToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** 모델이 요청한 도구 호출. */
export interface LlmToolUse {
  toolUseId: string;
  name: string;
  input: Record<string, unknown>;
}

/** 도구 실행 결과. Bedrock json 블록으로 직렬화된다. */
export interface LlmToolResult {
  toolUseId: string;
  output: unknown;
  isError?: boolean;
}

/**
 * 에이전트 대화의 한 턴.
 * toolResult 턴은 Bedrock 계약상 role "user" 로 전송된다.
 */
export type LlmAgentTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text?: string; toolUses?: LlmToolUse[] }
  | { role: "toolResult"; results: LlmToolResult[] };

export type LlmStopReason =
  | "tool_use" | "end_turn" | "max_tokens" | "stop_sequence"
  | "guardrail_intervened" | "content_filtered" | "other";

export interface LlmToolChatRequest {
  system: string;
  turns: LlmAgentTurn[];
  tools: LlmToolSpec[];
  /** 마지막 반복에서 도구 없이 답하게 강제할 때 사용 */
  disableTools?: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  guardrail?: { guardrailIdentifier: string; guardrailVersion: string } | false;
}

export interface LlmToolChatResult {
  stopReason: LlmStopReason;
  /** 이번 턴의 assistant 텍스트. 도구만 요청했으면 빈 문자열일 수 있다 */
  text: string;
  toolUses: LlmToolUse[];
  provider: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  raw?: unknown;
}
```

`LlmProvider` 인터페이스에 **optional** 메서드를 추가한다.

```ts
export interface LlmProvider {
  readonly name: string;
  chat(request: LlmChatRequest): Promise<LlmChatResult>;
  chatStream?(request: LlmChatRequest): AsyncIterable<string>;
  /** Bedrock Converse tool-use 한 턴. 미지원 프로바이더에는 없다. */
  converseWithTools?(request: LlmToolChatRequest): Promise<LlmToolChatResult>;
}
```

**optional 이어야 하는 이유:** `MockLlmProvider` 는 툴을 지원하지 않으며, 에이전트가 이 메서드의 존재 여부를 보고 규칙 경로로 폴백할 수 있어야 한다. 필수로 만들면 mock 프로바이더까지 고쳐야 하고 로컬 개발이 깨진다. `MockLlmProvider` 는 이번 작업에서 수정하지 않는다.

> 인터페이스는 호이스팅되므로 `LlmToolChatRequest` 를 파일 뒤쪽에 선언해도 참조 가능하다.

---

## STEP 2 — Bedrock 프로바이더에 `converseWithTools` 구현

**파일:** `src/backend/shared/llm/providers/bedrock.provider.ts`

기존 `chat()`, `chatStream()`, `buildPayload()` 는 **수정하지 말 것.** 메서드를 추가한다.

### 2-1. import 확장

```ts
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type ContentBlock,
  type Message,
  type Tool,
  type ToolConfiguration,
} from "@aws-sdk/client-bedrock-runtime";
```

### 2-2. 턴 → Bedrock content block 매핑

```ts
private buildAgentMessages(turns: LlmAgentTurn[]): Message[]
```

- `user` 턴 → `{ role: "user", content: [{ text }] }`
- `assistant` 턴 → `{ role: "assistant", content: [...] }`. 텍스트가 있으면 `{ text }` 블록을 먼저 넣고, 각 `toolUses` 를 `{ toolUse: { toolUseId, name, input } }` 로 넣는다. **이 턴을 그대로 되돌려주지 않으면 Bedrock이 `toolResult` 를 거부한다.**
- `toolResult` 턴 → `{ role: "user", content: [{ toolResult: { toolUseId, content: [{ json }], status } }] }`. `status` 는 `isError ? "error" : "success"`.
- **빈 블록 배열이 되는 턴은 건너뛴다.** Bedrock은 빈 content 를 거부한다.

`input` 과 `json` 은 SDK의 `DocumentType` 이라 `as never` 캐스팅이 필요하다. `as any` 는 쓰지 말 것 (ESLint 걸린다).

### 2-3. `converseWithTools()`

- `modelId` = `request.model?.trim() || env.bedrock.modelId`
- `messages` 가 비면 `throw new Error("Bedrock에 전달할 agent turn이 없습니다.")`
- `toolConfig` 조립. **`request.disableTools` 가 true 이거나 `tools.length === 0` 이면 `toolConfig` 를 아예 넘기지 않는다.** 빈 배열을 넘기면 ValidationException 이 난다.
  ```ts
  {
    tools: request.tools.map<Tool>((t) => ({
      toolSpec: {
        name: t.name,
        description: t.description,
        inputSchema: { json: t.inputSchema as never },
      },
    })),
  }
  ```
- `inferenceConfig` 기본값 `maxTokens: 2000`, `temperature: 0.6`. 기존 `chat()` 의 400 토큰 기본값은 툴 루프에 부족하다.
- Guardrail 은 계속 적용한다. 파일 하단 `resolveGuardrail(request: LlmChatRequest)` 의 시그니처를 `resolveGuardrail(request: { guardrail?: LlmChatRequest["guardrail"] })` 로 완화해 양쪽이 공유하게 할 것. 캐스팅으로 우회하지 말 것.
- 응답 파싱
  - `text` = content 블록 중 `"text" in block` 인 것들을 join 후 trim
  - `toolUses` = `"toolUse" in block && block.toolUse` 인 것들을 `{ toolUseId, name, input }` 으로 수집
  - `stopReason` 은 모듈 함수 `normalizeStopReason(raw: string | undefined): LlmStopReason` 로 정규화. 알 수 없는 값은 `"other"`
  - `usage` 에 `response.usage?.inputTokens / outputTokens`

---

## STEP 3 — 에이전트 런타임 (툴 루프)

**새 파일:** `src/backend/ai/agent/agent-runtime.ts`

파일 상단 주석에 라우팅을 하지 않는다는 사실을 명시할 것.

```ts
/**
 * Agent runtime — drives a bounded Bedrock tool-use loop for ONE agent.
 * It executes tools the model asks for, feeds results back, and stops on
 * an iteration cap or a time budget.
 * It does NOT route between features and does NOT decide who handles a request.
 */
```

### 3-1. 계약

```ts
export interface AgentToolCallLog {
  name: string;
  input: unknown;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface AgentTraceStep {
  step: string;
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

/** 도구 하나. run 은 JSON 직렬화 가능한 값을 반환해야 한다. */
export interface AgentTool {
  spec: LlmToolSpec;
  run: (input: Record<string, unknown>) => Promise<unknown>;
  /** true면 이 도구 호출로 루프를 종료한다 (결과 제출 도구) */
  terminal?: boolean;
}

export interface AgentRunOutcome {
  /** terminal 도구가 호출됐다면 그 input */
  submitted: Record<string, unknown> | null;
  finalText: string;
  stopReason: LlmStopReason;
  iterations: number;
  toolCalls: AgentToolCallLog[];
  trace: AgentTraceStep[];
  /** 예산 초과나 반복 상한으로 중단됐는지 */
  exhausted: boolean;
}

export async function runToolAgent(input: {
  feature: string;
  system: string;
  task: string;
  tools: AgentTool[];
  model: string;
  maxIterations?: number;  // 기본 6
  budgetMs?: number;       // 기본 20000
  temperature?: number;
  maxTokens?: number;
}): Promise<AgentRunOutcome>;
```

### 3-2. 루프 로직

```
provider = getLlmProvider()
if (!provider.converseWithTools) → throw. 호출자가 규칙 폴백으로 처리한다.

turns = [{ role: "user", text: task }]
for (i = 0; i < maxIterations; i++) {
  lastIteration = (i === maxIterations - 1) || remainingMs() < 3000
  res = await provider.converseWithTools({
    system, turns, tools: specs,
    disableTools: lastIteration,     // ← 마지막엔 도구를 끊어 답을 강제
    model, temperature, maxTokens
  })

  if (res.stopReason !== "tool_use" || res.toolUses.length === 0) {
    return { submitted: null, finalText: res.text, ... }
  }

  turns.push({ role: "assistant", text: res.text, toolUses: res.toolUses })

  results = []
  for (use of res.toolUses) {
    tool = tools.find(t => t.spec.name === use.name)
    if (!tool) {
      results.push({ toolUseId: use.toolUseId, isError: true,
                     output: { error: `unknown tool: ${use.name}` } })
      continue
    }
    if (tool.terminal) {
      return { submitted: use.input, finalText: res.text, ... }
    }
    try { out = await tool.run(use.input); results.push({ toolUseId, output: out }) }
    catch (e) { results.push({ toolUseId, isError: true, output: { error: 메시지 } }) }
  }
  turns.push({ role: "toolResult", results })
}
return { ..., exhausted: true }
```

핵심 요구사항:

- **미지 도구 이름은 throw 하지 말고 `isError` 결과로 모델에 알려준다.** 모델이 스스로 고칠 수 있다. 여기서 예외를 던지면 루프가 죽는다.
- **도구 실행 실패도 `isError` 결과로 되돌린다.** 저장소 조회가 실패하면 모델이 그 도구 없이 진행하도록 유도된다.
- **`terminal` 도구가 호출되면 즉시 종료한다.** 결과는 `submitted` 에 담는다. 자유 텍스트에서 JSON을 파싱하는 것보다 스키마 강제가 확실하다.
- **마지막 반복 또는 예산 3초 미만이면 `disableTools: true`.** 이게 없으면 모델이 도구만 계속 부르다 반복 상한에 걸려 빈손으로 끝난다.
- 모델이 한 턴에 여러 `toolUse` 를 보낼 수 있다. **순차 실행**이 안전하고, 하나의 `toolResult` 턴에 **모든** 결과를 담아야 한다. 나눠 보내면 Bedrock이 거부한다.

### 3-3. 계측

- 전체를 `observeAsync({ feature, operation: "agent", model, latencyMetric: "AgentLatencyMs" }, ...)` 로 감싼다
- 도구 호출마다 `recordLatency("AgentToolLatencyMs", latencyMs, { feature, operation: 도구이름 })`
- `recordCount("AgentToolCalls", 1, { feature, operation: 도구이름 })`
- 실패 시 `recordCount("AgentToolErrors", 1, { feature, operation: 도구이름 })` + `observeFailure(...)`
- 종료 후 `recordCount("AgentLoopIterations", iterations, { feature, operation: "loop" })`
- `exhausted` 면 `recordCount("AgentExhausted", 1, { feature, operation: "loop" })`
- `console.warn` 으로 실패를 삼키지 말 것

**대시보드에서 `AgentToolCalls` 가 도구 이름별로 쪼개져 보이는 것이 "LLM이 도구를 골랐다"의 증거다.**

---

## STEP 4 — 근거 카드 리포지토리

### 4-1. 데이터 이동

`docs/care-evidence-cards.json` 을 런타임 위치로 복사한다.

```
src/backend/ai/evidence/care-evidence-cards.json
```

`docs/` 쪽은 원본으로 남기고, 복사본 주석에 원본 위치를 적어 둔다. 카드가 21개뿐이므로 **Knowledge Base 도, S3 도, DynamoDB 도 쓰지 않는다.** JSON을 직접 import 한다. `tsconfig.json` 의 `resolveJsonModule` 이 꺼져 있으면 켠다.

### 4-2. 리포지토리

**새 파일:** `src/backend/ai/evidence/care-evidence.repository.ts`

```ts
import "server-only";

/**
 * Curated care-evidence cards extracted from two papers.
 * Deterministic filtering over a small fixed set — NOT vector search, NOT RAG.
 * Source of truth: docs/care-evidence-cards.json
 */

export type EvidenceSituation =
  | "treatment_day" | "long_stay" | "isolation" | "general";

export type EvidenceTiming = "before" | "after" | "anytime";

export type EvidenceStrength =
  | "rct" | "meta_analysis" | "controlled_study" | "pilot_study" | "qualitative";

/** 모델에게 돌려주는 형태 */
export interface EvidenceCardForAgent {
  id: string;
  mechanism: string;
  principle: string;
  activityPattern: string | null;
  mapsToKind: string[];
  childSafePhrasing: string | null;
  timing: EvidenceTiming;
  evidenceStrength: EvidenceStrength;
  avoidIf: string[];
  sourceLabel: string;
}

export function searchCareEvidence(input: {
  situation: EvidenceSituation;
  emotionTheme?: string;
  timing?: EvidenceTiming;
  age?: number | null;
  maxResults?: number;
}): EvidenceCardForAgent[];

/** 보호자 리포트용 출처 라벨 */
export function evidenceSourceLabels(cardIds: string[]): string[];

/** 검증 단계에서 쓰는 하드 제약 조회 */
export function evidenceAvoidRules(cardIds: string[]): string[];

/** 존재하는 카드 id 인지 확인 */
export function isKnownEvidenceId(id: string): boolean;
```

필터링 규칙. 전부 결정론적으로, LLM 없이 처리한다.

1. `situation` 이 카드의 `situation` 배열에 포함되거나 카드가 `"general"` 을 포함하면 통과
2. `emotionTheme` 이 주어지면 카드의 `emotionThemes` 중 하나와 부분 문자열로 겹치면 **가점**. 겹치지 않아도 배제하지는 않는다
3. `timing` 이 주어지면 카드의 `timing` 이 일치하거나 `"anytime"` 이면 통과
4. `age` 가 주어지면 카드의 `ageRange` 밖이면 배제. `ageRange` 가 `null` 인 카드는 통과
5. **`activityPattern` 이 `null` 인 카드는 기본 결과에서 제외한다.** `ev-006`, `ev-020`, `ev-021` 이 해당한다. 미션 후보가 아니라 설계 제약이므로 검증 단계에서만 쓴다
6. 정렬: `evidenceStrength` 우선순위(`rct` > `meta_analysis` > `controlled_study` > `pilot_study` > `qualitative`) → `emotionTheme` 일치 가점
7. `maxResults` 기본 4, 최대 6

---

## STEP 5 — 미션 에이전트

**새 파일:** `src/backend/features/adventure-quest/adventure-quest.agent.ts`

`prepareAdventurePackForDate()` 는 이 에이전트를 부르는 얇은 껍데기가 된다. `tryGenerateWithLlm()` 은 **지우지 않고** 2순위 폴백으로 남긴다.

### 5-1. 도구 7개

`inputSchema` 는 전부 JSON Schema 로 쓰고 `additionalProperties: false` 를 넣는다.

| 도구 | 입력 | 반환 | 근거 함수 |
|---|---|---|---|
| `get_hospital_schedule` | `{}` | `{ dayCount, items: [{ title, type, done }] }` | `getHospitalDay(userId)` |
| `get_emotion_trend` | `{ days?: number }` | `{ todayMood, recentMoods, latestEmotion, themes }` | `getGardenAccount` + `latestEmotionSummary` |
| `get_weather` | `{}` | `{ code, label, emoji, tempC, source }` | `getWeatherForUser(userId, date)` |
| `get_child_profile` | `{}` | `{ age, interests, energy, companionName }` | `getPersonaForUser(userId)` |
| `get_conversation_memory` | `{}` | `{ turnCount, emotionalThemes, toneHint }` | `getConversationMemory(userId)` |
| `get_recent_missions` | `{ days?: number }` | `{ titles: string[], scenes: string[] }` | `listAdventurePacksForUser(userId)` |
| `search_care_evidence` | 아래 스키마 | `EvidenceCardForAgent[]` | `searchCareEvidence(...)` |
| `submit_mission_pack` | 아래 스키마 | — (`terminal: true`) | 없음 |

**중요: 도구 클로저에 `userId` 와 `date` 를 캡처할 것.** 입력 스키마에 `userId` 를 절대 넣지 말 것. 모델이 다른 아이 ID를 넣을 수 있다. **보안 요구사항이다.** `get_weather` 도 `date` 를 입력으로 받지 않고 캡처한 값을 쓴다.

`search_care_evidence` 스키마:

```json
{
  "name": "search_care_evidence",
  "description": "장기입원 아동의 심리정서 지원 문헌에서 추출한 개입 근거를 찾는다. 오늘 상황과 감정 상태에 맞는 활동 원리와 아이에게 쓸 수 있는 표현을 돌려준다. 미션을 정하기 전에 호출하면 근거 있는 활동을 고를 수 있다. 상황에 따라 결과가 크게 달라지므로 일정과 감정을 먼저 파악한 뒤 호출하세요.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "situation": {
        "type": "string",
        "enum": ["treatment_day", "long_stay", "isolation", "general"],
        "description": "오늘 상황. 검사·치료가 있으면 treatment_day."
      },
      "emotionTheme": {
        "type": "string",
        "description": "예: 예상 불안, 위축, 무기력, 외로움, 억눌린 감정"
      },
      "timing": {
        "type": "string",
        "enum": ["before", "after", "anytime"],
        "description": "절차 전에 쓸 근거인지 후에 쓸 근거인지"
      },
      "maxResults": { "type": "integer", "minimum": 1, "maximum": 6 }
    },
    "required": ["situation"],
    "additionalProperties": false
  }
}
```

`age` 를 입력 스키마에 넣지 말 것. 클로저가 `context.age` 를 자동으로 넘긴다.

`submit_mission_pack` 스키마:

```json
{
  "type": "object",
  "properties": {
    "scene": { "type": "string", "enum": ["sunny","rainy","treatment","low_energy"] },
    "reasoning": { "type": "string", "description": "이 장면과 미션을 고른 근거 1~2문장" },
    "signalsUsed": { "type": "array", "items": { "type": "string" } },
    "evidenceRefs": {
      "type": "array",
      "items": { "type": "string" },
      "maxItems": 6,
      "description": "참고한 근거 카드 id. 예: [\"ev-001\", \"ev-003\"]"
    },
    "headline": { "type": "string" },
    "companionNote": { "type": "string" },
    "quests": {
      "type": "array", "minItems": 3, "maxItems": 3,
      "items": {
        "type": "object",
        "properties": {
          "emoji": { "type": "string" },
          "title": { "type": "string" },
          "hint": { "type": "string" },
          "points": { "type": "integer", "minimum": 10, "maximum": 20 },
          "kind": { "type": "string", "enum": ["photo","garden","chat","post","observe"] }
        },
        "required": ["emoji","title","hint","points","kind"],
        "additionalProperties": false
      }
    }
  },
  "required": ["scene","reasoning","headline","companionNote","quests"],
  "additionalProperties": false
}
```

`evidenceRefs` 는 `required` 에 넣지 않는다. 근거 없이 만든 경우도 구분해 기록해야 한다.

### 5-2. 시스템 프롬프트

`withBeddySafety()` 로 감싼다.

```
당신은 입원 청소년을 위한 앱 Beddy의 '오늘의 모험' 에이전트입니다.

작업 순서:
1. 먼저 필요한 정보를 도구로 조회하세요. 전부 조회할 필요는 없습니다.
   무엇이 오늘의 미션 결정에 영향을 주는지 스스로 판단해 고르세요.
2. 충분히 파악했으면 submit_mission_pack 으로 결과를 제출하세요.
3. 조회 없이 바로 제출하지 마세요. 최소한 일정과 감정은 확인하세요.

장면 결정 기준:
- 검사·치료가 있으면 treatment (날씨보다 우선)
- 기분이 슬픔·졸림·화남이거나 에너지가 낮으면 low_energy
- 비가 오면 rainy
- 그 외 sunny

근거 활용:
- 미션을 정하기 전에 search_care_evidence 를 호출해 근거를 확인하세요.
- 검사·치료가 있는 날은 situation=treatment_day, timing=before 로 조회하세요.
  문헌에서 효과가 가장 컸던 것은 끝난 뒤 위로가 아니라 시작 전 준비였습니다.
- 근거의 activityPattern 을 그대로 베끼지 말고 이 아이의 관심사와 상황에 맞게 바꾸세요.
- childSafePhrasing 은 참고 문장입니다. 그대로 써도 되고 다듬어도 됩니다.
- 근거의 avoidIf 에 걸리는 미션은 만들지 마세요.
- 논문 이름이나 통계 수치를 아이가 보는 문장에 넣지 마세요.
- 참고한 근거 카드 id 를 evidenceRefs 에 넣으세요.

미션 제약:
- 병실·복도·침대 근처에서 할 수 있어야 합니다.
- 각 미션은 앱 안의 활동으로 완료됩니다. kind 를 정확히 고르세요.
  photo 사진 업로드 / garden 감정 정원 / chat 베디와 대화
  post 우체국 편지 / observe 짧은 메모 또는 선택 사진
- 최근에 나온 미션 제목과 겹치지 않게 하세요.
- 위험하거나 무리한 활동, 야외 활동(맑은 날 병원 정원 제외)은 피하세요.
- 한국어. kind 는 최소 2종으로 나누세요.

절대 지킬 것:
- 미션은 항상 정확히 3개입니다. 아이마다 개수를 다르게 하지 마세요.
- points 는 10~20 범위를 벗어나지 마세요.
- 아이 얼굴이나 몸을 찍게 하는 미션을 만들지 마세요. 사물이나 풍경으로 하세요.
```

마지막 세 줄의 근거는 `ev-020`(형평성 — 보호자가 "쟤는 해주는데 왜 나는 안 해줘"에 매우 민감)과 `ev-016`(외모 변화로 인한 자발적 고립)이다. **프롬프트에만 적고 끝내지 말 것. STEP 6에서 코드로 강제한다.**

### 5-3. user 턴 (task)

**컨텍스트를 미리 붙이지 말 것.** 붙이면 모델이 도구를 부를 이유가 없어지고 이 작업 전체가 무의미해진다.

```
오늘 날짜: 2026-08-04
이 아이의 오늘 미션 3개를 만들어 주세요.
```

### 5-4. 모델과 예산

```ts
const AGENT_MODEL_PURPOSE = "quality" as const;   // Opus 4.6
const AGENT_MAX_ITERATIONS = 6;
const AGENT_BUDGET_MS = 20_000;
```

`resolveModelForPurpose("quality")` 로 모델 ID를 얻는다. 배치 경로라 Opus 로 충분하다. 상수로 빼두어 Haiku 로 내리기 쉽게 할 것.

---

## STEP 6 — 결정론적 검증

```ts
type PackValidation = { ok: true } | { ok: false; problems: string[] };

function validateSubmission(
  submitted: Record<string, unknown>,
  avoidTitles: string[]
): PackValidation;
```

**전부 LLM 없이 순수 함수로 판정한다.** 심사에서 "검증은 무엇이 하나요"에 "LLM이 알아서"는 답이 아니다.

기본 검사:

- `scene` 이 `AdventureScene` 4값 중 하나
- `quests` 가 정확히 3개 — *근거 `ev-020` 형평성*
- `kind` 종류가 최소 2가지
- `points` 가 10~20 정수 — *근거 `ev-020` 형평성*
- `title` 2~24자, `hint` 비어 있지 않음
- `title` 이 `avoidTitles` 와 정규화 후 완전 일치하면 실패
- `headline`, `companionNote`, `reasoning` 이 비어 있지 않음

근거 관련 검사:

```ts
// 신체 노출 — 근거 ev-016
const FACE_PATTERNS = /셀카|셀피|얼굴|내 모습|거울|자기 사진/;
// title 또는 hint 에 매칭되면 실패

// evidenceRefs 유효성
// isKnownEvidenceId() 로 확인. 존재하지 않는 id 가 있으면 실패 (모델이 지어낸 것)

// avoidIf 위반
// evidenceAvoidRules(evidenceRefs) 로 규칙을 모으고 대응 패턴 검사

// 검사일 사전 준비 — 경고만
// scene === "treatment" 인데 evidenceRefs 에 timing === "before" 카드가
// 하나도 없으면 problems 에 추가하되, 이것만으로 실패시키지는 말 것
```

마지막 항목을 실패 처리하지 않는 이유: 아이 상태에 따라 사후 위로가 맞는 날도 있다. 문헌 근거는 사전 준비가 강하지만 코드가 절대 규칙으로 만들면 유연성을 잃는다.

`avoidTitles` 는 에이전트 실행과 별개로 `listAdventurePacksForUser` 에서 최근 7일치를 미리 뽑아둔다. 모델이 `get_recent_missions` 를 부르지 않았더라도 검증은 해야 한다.

### 자기수정 최대 1회

검증 실패 + 예산 여유가 있으면 `problems` 를 담아 **한 번만** 재실행한다.

```
이전 제출에 다음 문제가 있었습니다. 고쳐서 다시 제출해 주세요:
- kind 가 3개 모두 photo 입니다. 최소 2종으로 나눠 주세요.
- "창밖 구름 찍기" 는 최근 7일 안에 이미 나온 제목입니다.
- ev-999 는 존재하지 않는 근거 id 입니다.
```

재실행 후에도 실패하면 `null` 을 반환해 호출자가 폴백으로 가게 한다.

### 팩 조립

- 각 퀘스트는 기존 `normalizeQuestKind(kind, title, hint)` 통과
- `id` 는 기존 규칙 `aq-${date}-${index}`
- `points` 는 `Math.min(20, Math.max(10, ...))` 로 클램프
- `factors` 는 기존 `buildFactorChips(context, scene)` 를 그대로 쓴다. 아이에게 보이는 근거 칩이라 형식을 바꾸면 UI가 어긋난다
- `context` 는 기존 `buildContext(userId, date)` 결과를 넣는다. **에이전트가 도구로 조회한 것과 별개로 한 번 더 부른다.** `ensureTodayPack()` 의 날씨 갱신 로직과 `buildFactorChips` 가 이 형태에 의존하므로 보장되어야 한다. 중복 조회 비용은 배치 경로라 무관하다
- `generatedBy` 는 `"agent"`

---

## STEP 7 — 배선 + 타입 확장

### 7-1. 타입

`adventure-quest.types.ts`:

```ts
generatedBy: "rules" | "llm" | "agent";
```

```ts
export interface AgentDecision {
  reasoning: string;
  signalsUsed: string[];
  toolsCalled: string[];
  iterations: number;
  repaired: boolean;
  /** 참고한 근거 카드 id */
  evidenceRefs?: string[];
  /** 보호자·심사 화면용 출처 라벨 */
  evidenceSources?: string[];
}

export interface AdventureDayPack {
  // 기존 필드 전부 유지
  agent?: AgentDecision;
}
```

- **`generatedBy` 를 읽는 곳을 먼저 검색할 것.** UI나 API가 `"llm"` 을 특별 취급하면 `"agent"` 도 통과하도록 **넓히는** 방향으로 고친다. 좁히지 말 것
- `agent` 는 optional 이라 기존 저장 데이터와 호환된다. DynamoDB는 스키마리스이므로 마이그레이션 불필요. `migratePack()` 수정 불필요
- `evidenceSources` 는 `evidenceSourceLabels(evidenceRefs)` 로 채운다

### 7-2. 서비스 배선

`adventure-quest.service.ts` 의 `prepareAdventurePackForDate()` 만 수정한다.

```ts
export async function prepareAdventurePackForDate(
  userId: string,
  date: string
): Promise<AdventureDayPack> {
  const context = await buildContext(userId, date);
  const scene = resolveScene(context);

  // 1순위: Tool Use 에이전트
  const agentPack = await tryGenerateWithAgent(userId, date, context);
  if (agentPack) return saveAdventurePack(agentPack);

  // 2순위: 기존 단일 호출 LLM 생성 (그대로 유지)
  const llmPack = await tryGenerateWithLlm(userId, date, context, scene);

  // 3순위: 규칙
  const pack = llmPack ?? buildRuleBasedPack(userId, date, scene, context);
  return saveAdventurePack(pack);
}
```

**`tryGenerateWithLlm()` 을 지우지 말 것.** 3단 폴백이 된다. Tool Use 가 Guardrail 조합 문제로 실패하더라도 기존 경로가 살아 있어 데모가 깨지지 않는다.

`tryGenerateWithAgent()` 는 다음 경우 즉시 `null` 을 반환한다.

- `env.llmProvider !== "bedrock"`
- `getLlmProvider().converseWithTools` 가 없음
- 에이전트가 throw 하거나 검증 2회 실패

### 7-3. 진입점

`src/backend/ai/agent/mission-agent.ts` (현재 2줄 re-export 껍데기)를 갱신한다.

```ts
/**
 * AI Agent — Today's Mission (Bedrock Tool Use).
 * The model chooses which tools to call, then submits via submit_mission_pack.
 * Tools: get_hospital_schedule / get_emotion_trend / get_weather /
 *        get_child_profile / get_conversation_memory / get_recent_missions /
 *        search_care_evidence
 * This is the only tool-use Agent in the system. The guardian path is RAG.
 */
export { prepareAdventurePackForDate } from "@/backend/features/adventure-quest/adventure-quest.service";
```

### 7-4. 보호자 노출 (선택)

시간이 남으면 `parent.service.ts` 의 오늘 요약에 `evidenceSources` 를 노출한다. **필수 범위가 아니다.**

문구를 조심할 것.

- 안전: `"오늘 활동은 아동 심리정서 지원 문헌을 참고해 골랐어요"` + 출처 라벨
- 위험: `"이 활동은 불안을 낮추는 것으로 입증되었어요"` → 앱 형태로는 검증되지 않았다

**아이 화면에는 근거를 노출하지 않는다.** 내부 추적과 보호자용이다.

---

## STEP 8 — 검증

컴파일 통과는 완료가 아니다.

```
npx tsc --noEmit
npm run build
```

> OneDrive 폴더라 `.next\server\app\...\page.js.nft.json` ENOENT 가 간헐 발생한다. 코드 문제가 아니다. `Remove-Item -Recurse -Force .next` 후 재실행하면 통과한다.

### 8-1. 금지어

`orchestrator`, `supervisor` 를 **새로 추가하지 않았는지** 확인한다. 기존 `ai/orchestrator.ts` 는 그대로 둔다.

### 8-2. Tool Use 동작

```
POST /api/cron/daily        헤더 x-bedi-cron-secret
```

첫 호출 `accepted: true`, 즉시 재호출 `skipped: true`, `?force=1` 로 재실행.

DynamoDB `adventure-packs` 네임스페이스의 오늘 날짜 항목에서 확인:

- `generatedBy === "agent"` 인가. `"llm"` 이면 Tool Use 가 실패해 2순위로 떨어진 것이다
- `agent.toolsCalled` 에 도구 이름이 2개 이상 있는가
- `agent.iterations >= 2` 인가. 1이면 도구를 안 부르고 바로 제출한 것이다
- `agent.evidenceRefs` 가 채워졌는가. 비어 있으면 근거 활용 지시가 약한 것
- `agent.reasoning` 이 실제 컨텍스트를 반영하는가

### 8-3. 도구 선택이 실제로 분기하는지 — **가장 중요한 검증**

조건이 다른 두 상황으로 배치를 돌려 비교한다.

- 검사 일정이 있는 날 → `search_care_evidence` 가 `situation: "treatment_day"`, `timing: "before"` 로 호출되는지
- 일정을 비우고 기분을 `sad` 로 둔 날 → `situation` 이 `"long_stay"` 나 `"general"` 로, `emotionTheme` 이 다르게 들어오는지

**두 경우의 `toolsCalled` 목록과 인자가 같으면 실패다.** 모델이 판단하지 않고 기계적으로 부르는 것이므로 시스템 프롬프트의 "전부 조회할 필요는 없습니다" 와 도구 `description` 을 강화할 것.

### 8-4. Guardrail + toolConfig 조합

**실제 AWS 자격증명으로 반드시 확인할 것.** Bedrock Guardrails 와 `toolConfig` 를 함께 보낼 때 모델·리전에 따라 `ValidationException` 이 날 수 있다. CloudWatch 로그에서 `AgentToolErrors` 나 예외를 확인한다.

실패하면 둘 중 선택한다.

1. `converseWithTools` 호출에만 `guardrail: false` 를 넘긴다. 근거: 미션은 활동 제안이고, 시스템 프롬프트의 `withBeddySafety()` 와 결정론적 `validateSubmission()` 이 남아 있으며, 아이에게 직접 노출되는 대화 경로는 여전히 Guardrail 을 통과한다. **이 결정을 코드 주석에 남길 것**
2. Tool Use 를 포기하고 2순위 경로로 데모한다

**말없이 Guardrail 을 끄지 말 것.**

### 8-5. 검증 함수가 실제로 잡아내는지

일부러 깨뜨려 확인한 뒤 원복한다.

- 프롬프트의 얼굴 촬영 금지 문구를 임시로 빼고 → `FACE_PATTERNS` 가 잡는지
- 프롬프트에 가짜 근거 id 예시(`ev-999`)를 넣고 → `isKnownEvidenceId` 가 잡는지
- `kind` 다양성 조건을 임시로 3종 필수로 강화하고 → 재생성 1회 후 폴백으로 떨어지는지

### 8-6. 회귀 확인

- **대화 속도** — 대화 3회 주고받으며 `BedrockFirstTokenMs` 가 작업 전 수준인지. 느려졌다면 툴이 대화 경로에 새어 들어간 것이다
- **`/adventure` 화면** — 미션 3개가 정상 렌더되고, 사진·정원·대화·편지 진행이 기존대로 완료 처리되는지. `actionHref` 와 `kind` 매핑이 깨지지 않았는지
- **아이 화면에 논문 흔적이 없는지** — 미션 문구에 통계·논문명·병명·의료 용어가 없는지. 특히 `ev-016` 의 `principle` 에 병명이 있으므로 새어나오지 않는지 확인
- **규칙 폴백** — `LLM_PROVIDER=mock` 으로 띄워 규칙 팩이 나오는지
- 리허설 중에는 `LLM_FALLBACK_TO_MOCK=false` 로 두고 실패를 드러낸다

---

## STEP 9 — 사람이 반드시 할 일

`care-evidence-cards.json` 의 `reviewStatus` 가 `"draft-needs-human-review"` 다. 다음을 사람이 확인한 뒤 `"reviewed"` 로 바꾼다.

1. **`childSafePhrasing` 21개 문장** — 아이에게 그대로 보여도 되는 말투인지. 지시적이거나 어른 말투면 고칠 것
2. **`mapsToKind` 매핑** — 각 근거가 실제 앱 활동으로 완료 가능한지
3. **의료 내용 잔류** — `ev-016` 의 `principle` 에 "이식편대증후군"이 있다. 이 문장이 프롬프트로 가므로 아이 쪽 출력에 병명이 새지 않는지 특히 확인
4. **`ev-003` 과 `ev-012`** — 일정 안내 관련 카드다. 기존 `hospital-day.schedule-copy` 와 중복되어 같은 말을 반복하지 않는지

검수 없이 배포하면 논문에서 뽑은 문장이 아이에게 그대로 갈 수 있다.

---

## STEP 10 — 문서 갱신

- `docs/ai-capabilities.svg` / `.png` — Agent 레인을 Tool Use 6단계로 교체하고 도구 7개를 명시. 점선을 실선으로. `search_care_evidence` 가 `ai/evidence/` 에 있고 RAG가 아니라는 점 표기
- `docs/architecture-detail.svg` · `architecture-flow.svg` · `architecture-models.svg` — 툴 루프가 Bedrock 호출 3~6회임을 명시
- `docs/cursor-prompt.md` STEP 3 섹션

---

## 발표에서 쓸 문장

> **오늘의 미션은 AI Agent입니다.** Bedrock Converse의 Tool Use를 씁니다. 도구 7개를 정의해 모델에게 넘기고, 모델이 `stopReason: tool_use` 로 필요한 도구를 요청하면 서버가 실행해서 결과를 되돌려줍니다. 무엇을 조회할지는 코드가 아니라 모델이 정합니다. 아이마다 호출하는 도구 목록이 다릅니다.
>
> 도구 중 하나가 `search_care_evidence` 입니다. 장기입원 아동 심리정서 지원 문헌 2편에서 개입 근거를 활동 단위로 추출해 21개 카드로 구조화했습니다. 하나는 7~12세 203명 무작위 대조 시험이고, 하나는 국내 상급종합병원 전문가 12명 심층면담 연구입니다. 근거 강도를 카드마다 구분해 저장했습니다.
>
> 검사가 있는 날은 Agent가 `timing: before` 로 조회합니다. 문헌에서 효과가 가장 컸던 것이 끝난 뒤 위로가 아니라 시작 전 준비였기 때문입니다. 실제로 수술 전 불안에서 가장 큰 차이가 나왔습니다.
>
> 마지막에 모델은 `submit_mission_pack` 도구로 결과를 제출합니다. 자유 텍스트 파싱이 아니라 JSON Schema로 강제됩니다. 제출된 결과는 LLM이 아닌 결정론적 검증 함수를 통과해야 합니다. 미션 개수와 포인트 범위를 고정하는 건 형평성 근거 때문이고, 얼굴 촬영 미션을 차단하는 건 외모 변화로 위축되는 환아에 대한 근거 때문입니다. 실패하면 문제점을 알려주고 한 번 재생성하고, 그래도 실패하면 규칙 기반으로 떨어집니다.
>
> 반복 상한 6회와 시간 예산 20초를 둘 다 강제합니다. 새벽 배치 경로라 지연이 무관해서 이 판단들을 넣을 수 있었습니다. **아이 대화 경로에는 일부러 넣지 않았습니다** — 거기서는 첫 토큰까지의 시간이 전부입니다.
>
> 다만 분명히 말씀드리면, **효과가 입증된 미션이 아니라 근거를 참조해 설계한 미션입니다.** 두 문헌 모두 앱으로 매일 반복하는 형태를 검증하지 않았습니다.

마지막 문단을 빼지 말 것. 근거를 과장하면 첫 질문에서 무너진다. 한계를 먼저 말하면 나머지 주장이 신뢰를 얻는다.

### 즉시 열어 보여줄 좌표

| 주장 | 파일 |
|---|---|
| 툴 루프 | `backend/ai/agent/agent-runtime.ts` 의 `runToolAgent` |
| `toolConfig` 전달 | `backend/shared/llm/providers/bedrock.provider.ts` 의 `converseWithTools` |
| 도구 정의 | `backend/features/adventure-quest/adventure-quest.agent.ts` |
| 결정론적 검증 | 같은 파일의 `validateSubmission` |
| 근거 카드 | `backend/ai/evidence/care-evidence-cards.json` |
| 근거 필터 | `backend/ai/evidence/care-evidence.repository.ts` |
| 증거 | DynamoDB 팩의 `agent.toolsCalled` · `agent.evidenceRefs`, CloudWatch `AgentToolCalls` (도구 이름 차원) |

---

## 작업 순서와 중단 지점

```
STEP 1 → 2 → 3 → (커밋) → 4 → 5 → 6 → 7 → 8 전체 → 9 → 10
```

**STEP 3까지 끝내고 한 번 커밋할 것.** 그 시점에 툴 루프 자체는 완성되므로, 이후에 시간이 부족해도 되돌릴 지점이 남는다.

시간이 부족할 때 줄이는 순서:

1. STEP 7-4 (보호자 노출) 생략 — 저장만 한다
2. 도구를 7개에서 4개로 줄인다 (`get_hospital_schedule`, `get_emotion_trend`, `get_recent_missions`, `search_care_evidence`). **도구 개수가 아니라 모델이 고른다는 사실이 핵심이다.** 4개로도 주장은 완전히 성립한다
3. STEP 4~6 (근거 도구)을 빼고 도구 6개로 간다. 이 경우 Agent 주장은 성립하지만 "논문 근거" 주장은 접어야 한다

**STEP 8-3 은 어떤 경우에도 생략하지 말 것.** 도구 인자가 상황에 따라 달라지는지 확인하지 않으면 "LLM이 도구를 고른다"를 증명할 수 없고, 이 작업의 목적 자체가 사라진다.
