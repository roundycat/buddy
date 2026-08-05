# STEP 6 — Knowledge Bases (S3 Vectors) + AI Bridge RAG

## What shipped

- **S3 summaries only** under `kb-summaries/{childUserId}/…` (no raw chat)
- Dawn batch job indexes memory / emotion / missions / timeline / interests
- `askParentReport` → KB Retrieve → privacy filter → Opus
- Storybook compose also pulls KB highlights
- Metrics: existing `observeKbSearch` → `KbSearchLatencyMs`
- Script: `scripts/aws/11-knowledge-base.ps1`

## Env
```
BEDROCK_KB_ID=<from last-kb-id.txt>
```

## AWS
- Vector store: **S3 Vectors** (`bedi-kb-vectors-{account}`)
- Data source: existing CodeBuild bucket `kb-summaries/`
- OpenSearch **not** used

## Privacy
- `ai/bridge/privacy-filter.ts` drops transcript-like / coordinate text
- Retrieve results scoped by S3 path containing childUserId
