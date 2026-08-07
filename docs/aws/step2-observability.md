# STEP 2 — Observability

## What shipped

- Structured logs: `[bedi:obs] { feature, model, latencyMs, success, requestId, … }`
- CloudWatch custom namespace **`Beddy`**
  - `BedrockLatencyMs`, `BedrockFirstTokenMs`, `Invocations`, `Errors`
  - `DynamoLatencyMs`
  - `S3WriteErrors`, `S3ReadErrors`, `StorageErrors`
  - Placeholders: `AgentLatencyMs`, `KbSearchLatencyMs`
- Orchestrator wraps child chat streams/one-shots
- Dynamo map-store get/put timed
- Avatar / schedule-image S3 failures upgraded from `console.warn` → `observeFailure`

## AWS resources

| Resource | Name |
|----------|------|
| Dashboard | [Beddy-Observability](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=Beddy-Observability) |
| Alarm (errors) | `Beddy-LlmErrorRate` — Errors ≥ 3 / 5 min |
| Alarm (latency) | `Beddy-LlmLatencyP95` — avg BedrockLatencyMs > 8000 ms (p95 proxy at low volume) |
| SNS | `bedi-ops-alerts` |

Provision / refresh: `scripts/deploy/07-observability.ps1`

## STEP 1 numbers (still valid)

See `docs/aws/step1-latency.md` — chat first token **2139 → 1413 ms (−34%)** after Haiku routing.
