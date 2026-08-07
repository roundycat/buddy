# Open Source Cleanup Summary Report

**Date:** 2026-08-07  
**Constraint honored:** No application behavior / business-logic changes.

## Done

### Deleted
| Item | Reason |
|------|--------|
| `.tmp-svc.png` | Temp artifact |
| `scripts/remove_bg.py` | Local one-off with absolute paths |
| `mcp.json` | Local MCP config (must not be public) |
| `docs/cursor-prompt.md`, `docs/cursor-prompt-final.md` | Internal agent prompts |
| `docs/care-evidence-cards.json` | Unused draft (no runtime module) |
| `docs/aws-mcp-bedi-architecture.png` | Superseded duplicate |
| `docs/aws-pipeline-user-to-discharge.png` | Superseded by `pipeline-user-to-discharge.*` |
| `docs/generated-diagrams/` | Unused generated PNG |
| Empty dead dirs `companion-status`, `src/services`, `src/types` | Already unused |

### Untracked / gitignored
| Item | Action |
|------|--------|
| `scripts/*/last-deploy-url.txt`, `last-kb-id.txt`, `last-guardrail.json` | `git rm --cached`; ignore under `scripts/deploy/last-*` |
| `.env`, `.env*.local`, `.vscode`, `.idea`, `logs`, `tmp`, `.cache`, `mcp.json`, `.tmp*` | Strengthened `.gitignore` |

### Reorganized (path updates applied)
```
docs/
  architecture/   # diagrams
  aws/            # step notes + integration/
  demo/
  api/
  images/aws-icons/
  internal/       # historical reports
  production/ presentation/  # kept

scripts/
  deploy/         # was scripts/aws
  seed/
  migration/
  docs/           # diagram exporters
```

### Added
- Portfolio `README.md`
- `LICENSE` (MIT)
- `docs/README.md`, `docs/api/README.md`, `scripts/README.md`
- Softened `.env.example` placeholder secret

### Verified
- `npm run typecheck` passed after cleanup

## Explicitly deferred (would change contracts / risk behavior)

| Request | Why deferred |
|---------|----------------|
| Rename `parent` → `guardian` across API/folders | Breaks `/api/parent/*` clients & imports; UI already uses `/guardian` |
| Restructure every feature into `ui/hooks/services` | Large churn, high regression risk, no behavior gain |
| Remove `mock` LLM / mock auth users | Required for local/demo without Bedrock |
| Strip demo passwords from seed/MOCK_USERS | Would break documented demo login; documented as public demo creds instead |
| Unused npm dependency purge | Needs dedicated depcheck pass; skipped to avoid accidental removals |

## Before first public push

1. Confirm `.env.local` / `last-secret-arn.txt` / `last-deploy.log` are not staged  
2. `git add` intended paths; review `git status` for secrets  
3. Rotate any Dynamo demo passwords used on shared AWS accounts  
4. Optional follow-up PR: API alias `/api/guardian/*` → existing parent handlers (compat layer)
