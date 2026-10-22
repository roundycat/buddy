#!/usr/bin/env bash
# Show server + HTTPS status. Run in CloudShell.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$HERE/.state.env"
export AWS_DEFAULT_REGION="$REGION" AWS_PAGER=""
echo "instance: $(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query 'Reservations[0].Instances[0].State.Name' --output text)"
CMD_ID="$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name AWS-RunShellScript \
  --parameters 'commands=["curl -s -o /dev/null -w %{http_code} http://localhost/api/health; echo; docker ps --format {{.Status}}"]' \
  --query Command.CommandId --output text)"
sleep 5
echo "app: $(aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --query StandardOutputContent --output text | tr '\n' ' ')"
echo "https: https://$CF_DOMAIN ($(aws cloudfront get-distribution --id "$CF_ID" --query Distribution.Status --output text))"
echo "public check: $(curl -s -o /dev/null -w '%{http_code}' "https://$CF_DOMAIN/api/health" || echo fail)"
