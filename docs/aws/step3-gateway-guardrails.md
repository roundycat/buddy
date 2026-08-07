# STEP 3 — LLM Gateway + Guardrails + prompt consolidation

## Guardrail

| Field | Value |
|-------|--------|
| Name | `bedi-safety` |
| Id | `opr7cxjd4txo` |
| Version | `1` |
| Region | `us-east-1` |

Denies medical diagnosis / prescription / lab interpretation / suicide-method assistance topics; content filters; PII anonymize (email/phone/name/address).

**Crisis path:** Keyword detect → empathy + in-app help actions (guardian / nurse / 109 / 119) → summary-only parent safety alert. Raw child chat is never shared. Prompt: `BEDDY_SUICIDE_PREVENTION_GUIDE` + `BEDDY_CRISIS_RESPONSE_PROTOCOL` in `src/backend/ai/prompts/safety.ts`.

Env: `BEDROCK_GUARDRAIL_ID`, `BEDROCK_GUARDRAIL_VERSION`  
Create/refresh: `scripts/deploy/09-guardrail.ps1` (updates existing guardrail then publishes a version).

## Prompt consolidation

- Single safety constant: `src/backend/ai/prompts/safety.ts` (`BEDDY_SAFETY_RULES`)
- Companion prompt: `src/backend/ai/prompts/companion.ts` (re-exported from shared llm path)

## LLM Gateway

- `runLlm()` — all feature Converse calls
- Companion stream/chat — still via LLM Gateway helpers
- Bedrock provider applies guardrail on Converse / ConverseStream

Feature services no longer call `getLlmProvider()` directly (only `shared/llm` + LLM Gateway).
