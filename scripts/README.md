# Scripts

| Folder | Purpose |
|--------|---------|
| [`deploy/`](./deploy/) | AWS provision & deploy (ECS, secrets, Guardrail, KB, EventBridge, observability) |
| [`seed/`](./seed/) | DynamoDB seed / restore / wipe / Bedrock smoke check |
| [`migration/`](./migration/) | One-off data migrations |
| [`docs/`](./docs/) | SVG → PNG diagram exporters |

Deploy outputs such as `last-deploy-url.txt` / `last-guardrail.json` are **gitignored** — do not commit them.
