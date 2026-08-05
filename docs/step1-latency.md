# STEP 1 — Immediate-path latency

Measured locally on 2026-08-05 against Bedrock `us-east-1`.

## Model routing (child chat)

| Path | Model | First token |
|------|--------|-------------|
| Before (chat used `BEDROCK_MODEL_ID`) | `claude-opus-4-6` | **2139 ms** |
| After (`BEDROCK_MODEL_ID_CHAT`) | `claude-haiku-4-5` | **1413 ms** |

**Δ first token: −726 ms (−34%)** on a short “안녕” stream probe  
(`node --env-file=.env.local scripts/bench-step1.mjs`)

## Structural changes (not fully reflected in first-token alone)

1. **SSE `done` before persist/analysis** — child input unlocks without waiting for memory + emotion LLM (previously 2 extra Bedrock calls blocked `done`).
2. **`resolveChildCompanionContext` via `Promise.all`** — persona / history / memory / wishes no longer sequential.
3. Chat goes through `src/backend/ai/llm-gateway.ts` with purpose=`chat`.

## How to re-measure

```bash
node --env-file=.env.local scripts/bench-step1.mjs
node --env-file=.env.local scripts/bench-step1-context.mjs
```

Stream turns also log: `[conversation:timing] ctxMs=… firstTokenMs=… streamMs=… model=…`
