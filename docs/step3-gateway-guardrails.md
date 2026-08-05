# STEP 3 — LLM Gateway + Guardrails + prompt consolidation

## Guardrail

| Field | Value |
|-------|--------|
| Name | `bedi-safety` |
| Id | `opr7cxjd4txo` |
| Version | `1` |
| Region | `us-east-1` |

Denies medical diagnosis / prescription / lab interpretation topics; content filters; PII anonymize (email/phone/name/address).

**Crisis path (product decision):** Guardrail + prompt redirect only. No automatic guardian notification yet.

Env: `BEDROCK_GUARDRAIL_ID`, `BEDROCK_GUARDRAIL_VERSION`  
Create/refresh: copy ASCII JSON to TEMP then `aws bedrock create-guardrail` (see `scripts/aws/09-guardrail.ps1` notes).

## Prompt consolidation

- Single safety constant: `src/backend/ai/prompts/safety.ts` (`BEDDY_SAFETY_RULES`)
- Companion prompt: `src/backend/ai/prompts/companion.ts` (re-exported from shared llm path)

## LLM Gateway

- `runLlm()` — all feature Converse calls
- Companion stream/chat — still via LLM Gateway helpers
- Bedrock provider applies guardrail on Converse / ConverseStream

Feature services no longer call `getLlmProvider()` directly (only `shared/llm` + LLM Gateway).
