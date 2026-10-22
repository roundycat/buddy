#!/usr/bin/env bash
# Push the current source to the running server (rebuild + restart, ~5 min). Run in CloudShell.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
# shellcheck disable=SC1091
source "$HERE/.state.env"
export AWS_DEFAULT_REGION="$REGION" AWS_PAGER=""
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
( cd "$ROOT" && zip -q -r "$WORK/source.zip" . -x 'node_modules/*' '.next/*' '.git/*' '.data/*' '.claude/*' 'deploy/aws/.state.env' '*.log' '.env' '.env.*' '*/.env' '*/.env.*' )
aws s3 cp "$WORK/source.zip" "s3://$BUCKET/deploy/source.zip" --only-show-errors
CMD_ID="$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name AWS-RunShellScript \
  --timeout-seconds 1200 --parameters 'commands=["/opt/beddy/update.sh"]' --query Command.CommandId --output text)"
echo "rebuilding on $INSTANCE_ID (command $CMD_ID)…"
aws ssm wait command-executed --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" 2>/dev/null || true
aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" \
  --query '[Status,StandardOutputContent]' --output text | tail -5
bash "$HERE/status.sh"
