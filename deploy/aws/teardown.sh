#!/usr/bin/env bash
# Delete every resource deploy.sh created (asks first). Run in CloudShell.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$HERE/.state.env"
export AWS_DEFAULT_REGION="$REGION" AWS_PAGER=""
read -r -p "정말 ${PREFIX} 리소스를 모두 지울까요? 데이터(대화·사진)도 사라집니다. (yes 입력) " ans
[ "$ans" = "yes" ] || { echo "취소"; exit 0; }

if [ -n "${CF_ID:-}" ]; then
  echo "CloudFront 비활성화…"
  ETAG="$(aws cloudfront get-distribution-config --id "$CF_ID" --query ETag --output text)"
  aws cloudfront get-distribution-config --id "$CF_ID" --query DistributionConfig > /tmp/cf.json
  python3 - <<'PY'
import json; p="/tmp/cf.json"; d=json.load(open(p)); d["Enabled"]=False; json.dump(d,open(p,"w"))
PY
  aws cloudfront update-distribution --id "$CF_ID" --if-match "$ETAG" --distribution-config file:///tmp/cf.json >/dev/null
  aws cloudfront wait distribution-deployed --id "$CF_ID"
  ETAG="$(aws cloudfront get-distribution --id "$CF_ID" --query ETag --output text)"
  aws cloudfront delete-distribution --id "$CF_ID" --if-match "$ETAG" || true
fi
[ -n "${INSTANCE_ID:-}" ] && { aws ec2 terminate-instances --instance-ids "$INSTANCE_ID" >/dev/null; aws ec2 wait instance-terminated --instance-ids "$INSTANCE_ID"; }
[ -n "${SG_ID:-}" ] && aws ec2 delete-security-group --group-id "$SG_ID" || true
if [ -n "${PROFILE:-}" ]; then
  aws iam remove-role-from-instance-profile --instance-profile-name "$PROFILE" --role-name "$ROLE" || true
  aws iam delete-instance-profile --instance-profile-name "$PROFILE" || true
fi
if [ -n "${ROLE:-}" ]; then
  aws iam delete-role-policy --role-name "$ROLE" --policy-name app-access || true
  aws iam detach-role-policy --role-name "$ROLE" --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore || true
  aws iam delete-role --role-name "$ROLE" || true
fi
if [ -n "${KB_ID:-}" ]; then
  aws bedrock-agent delete-data-source --knowledge-base-id "$KB_ID" --data-source-id "$KB_DS_ID" >/dev/null || true
  sleep 5
  aws bedrock-agent delete-knowledge-base --knowledge-base-id "$KB_ID" >/dev/null || true
  aws s3vectors delete-index --vector-bucket-name "$KB_VECTOR_BUCKET" --index-name "${PREFIX}-summaries" || true
  aws s3vectors delete-vector-bucket --vector-bucket-name "$KB_VECTOR_BUCKET" || true
  aws iam delete-role-policy --role-name "$KB_ROLE" --policy-name kb-access || true
  aws iam delete-role --role-name "$KB_ROLE" || true
fi
[ -n "${GUARDRAIL_ID:-}" ] && aws bedrock delete-guardrail --guardrail-identifier "$GUARDRAIL_ID" || true
aws dynamodb delete-table --table-name "$TABLE" >/dev/null || true
aws s3 rm "s3://$BUCKET" --recursive --only-show-errors || true
aws s3api delete-bucket --bucket "$BUCKET" || true
for name in $(aws ssm get-parameters-by-path --path "/${PREFIX}" --query 'Parameters[].Name' --output text); do
  aws ssm delete-parameter --name "$name" || true
done
rm -f "$HERE/.state.env"
echo "삭제 완료"
