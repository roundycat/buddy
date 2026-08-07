# Migration Report — Amazon CloudWatch

**Date:** 2026-08-06  
**Status:** Complete

## Before

`console.error` only.

## After

| Piece | Path |
|-------|------|
| Metrics | `shared/observability/metrics.ts` — namespace **`Beddy`** |
| Structured logs | `shared/observability/log.ts` — `[bedi:obs]` |
| Dashboard / alarms | `scripts/deploy/07-observability.ps1` |

## Example metrics

`BedrockLatencyMs`, `BedrockFirstTokenMs`, `Invocations`, `Errors`, `DynamoLatencyMs`, `S3WriteErrors`, `KbSearchLatencyMs`, `AgentToolCalls`, `RagQueryRewrites`, cron failure counters.

## Env

```
BEDDY_METRICS=1   # set 0 to disable PutMetricData
```

## UX

No UI change — ops visibility only.
