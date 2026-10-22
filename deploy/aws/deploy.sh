#!/usr/bin/env bash
# Beddy 2.0 — one-shot AWS deployment, made to run in AWS CloudShell.
#
#   1) AWS 콘솔 우측 상단 CloudShell 열기 (리전: 미국 동부 버지니아 북부 us-east-1)
#   2) Actions → Upload file 로 beddy2-deploy.zip 업로드
#   3) unzip -q beddy2-deploy.zip -d beddy2 && cd beddy2 && bash deploy/aws/deploy.sh
#
# Creates (all names start with "beddy2-"):
#   S3 bucket (media + KB summaries + source bundle), DynamoDB table, SSM SecureString secrets,
#   Bedrock Guardrail, Bedrock Knowledge Base on S3 Vectors (optional), IAM role,
#   one EC2 instance (Docker, app on port 80) and a CloudFront HTTPS endpoint in front of it.
# Re-running is safe: existing resources are reused. Remove everything with deploy/aws/teardown.sh.
set -euo pipefail

REGION="${REGION:-us-east-1}"
IMAGE_REGION="${IMAGE_REGION:-us-west-2}"
PREFIX="${PREFIX:-beddy2}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.medium}"
CHAT_MODEL="${CHAT_MODEL:-us.anthropic.claude-haiku-4-5-20251001-v1:0}"
QUALITY_MODEL="${QUALITY_MODEL:-us.anthropic.claude-sonnet-4-5-20250929-v1:0}"
ENABLE_KB="${ENABLE_KB:-1}"
AI_DAILY_LLM_CAP="${AI_DAILY_LLM_CAP:-6000}"
AI_DAILY_IMAGE_CAP="${AI_DAILY_IMAGE_CAP:-200}"

export AWS_DEFAULT_REGION="$REGION"
export AWS_PAGER=""
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$ROOT/deploy/aws"
STATE="$HERE/.state.env"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log()  { printf '\n\033[1;36m[%s] %s\033[0m\n' "$(date +%H:%M:%S)" "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33m    ! %s\033[0m\n' "$*"; }
save() { touch "$STATE"; grep -v "^$1=" "$STATE" > "$STATE.tmp" || true; echo "$1=$2" >> "$STATE.tmp"; mv "$STATE.tmp" "$STATE"; }

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${PREFIX}-data-${ACCOUNT}-${REGION}"
TABLE="${PREFIX}-app"
ROLE="${PREFIX}-ec2-role"
PROFILE="${PREFIX}-ec2-profile"
SG_NAME="${PREFIX}-web"
PARAM="/${PREFIX}"
save ACCOUNT "$ACCOUNT"; save REGION "$REGION"; save PREFIX "$PREFIX"; save BUCKET "$BUCKET"; save TABLE "$TABLE"
info "account=$ACCOUNT region=$REGION prefix=$PREFIX"

# ── 0. Bedrock model access ─────────────────────────────────────────────────
log "0/10 Bedrock 모델 접근 확인"
probe_model() {
  aws bedrock-runtime converse --region "$REGION" --model-id "$1" \
    --messages '[{"role":"user","content":[{"text":"안녕"}]}]' \
    --inference-config '{"maxTokens":5}' >/dev/null 2>"$WORK/probe.err"
}
if ! probe_model "$CHAT_MODEL"; then
  cat "$WORK/probe.err" >&2
  cat >&2 <<'MSG'

  Bedrock에서 Claude Haiku 4.5를 호출할 수 없습니다.
  콘솔 → Amazon Bedrock → Model catalog(또는 Model access)에서 Anthropic Claude 모델 사용을
  한 번 신청·활성화한 뒤 다시 실행해 주세요. (처음 한 번 사용 목적을 적는 양식이 나올 수 있습니다)
MSG
  exit 1
fi
info "chat model OK: $CHAT_MODEL"
if probe_model "$QUALITY_MODEL"; then
  info "quality model OK: $QUALITY_MODEL"
else
  warn "quality model 사용 불가 → chat 모델로 대체 ($QUALITY_MODEL)"
  QUALITY_MODEL="$CHAT_MODEL"
fi

# ── 1. S3 bucket ────────────────────────────────────────────────────────────
log "1/10 S3 버킷 ($BUCKET)"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  info "exists"
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
  aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  info "created (private, encrypted)"
fi
printf '# Beddy KB summaries\nPrivacy-safe child summaries only. No raw chat.\n' > "$WORK/keep.md"
aws s3 cp "$WORK/keep.md" "s3://$BUCKET/kb-summaries/_keep/README.md" --only-show-errors

# ── 2. DynamoDB ─────────────────────────────────────────────────────────────
log "2/10 DynamoDB ($TABLE)"
if aws dynamodb describe-table --table-name "$TABLE" >/dev/null 2>&1; then
  info "exists"
else
  aws dynamodb create-table --table-name "$TABLE" --billing-mode PAY_PER_REQUEST \
    --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
    --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
    --sse-specification Enabled=true >/dev/null
  aws dynamodb wait table-exists --table-name "$TABLE"
  aws dynamodb update-continuous-backups --table-name "$TABLE" \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true >/dev/null || true
  info "created (on-demand, encrypted, PITR)"
fi

# ── 3. Secrets (SSM SecureString) ───────────────────────────────────────────
log "3/10 비밀값 (SSM Parameter Store)"
ensure_secret() {
  local name="$1" value="$2"
  if aws ssm get-parameter --name "$PARAM/$name" >/dev/null 2>&1; then
    info "$name exists"
  else
    aws ssm put-parameter --name "$PARAM/$name" --type SecureString --value "$value" >/dev/null
    info "$name created"
  fi
}
readable_pw() { printf 'Bd%s!%s' "$(openssl rand -hex 3)" "$(openssl rand -hex 2 | tr 'a-f' 'A-F')"; }
ensure_secret AUTH_SESSION_SECRET "$(openssl rand -hex 32)"
ensure_secret CRON_SECRET "$(openssl rand -hex 24)"
ensure_secret DEMO_CHILD_PASSWORD "$(readable_pw)"
ensure_secret DEMO_GUARDIAN_PASSWORD "$(readable_pw)"
ensure_secret JUDGE_PASSWORD "$(readable_pw)"

# ── 4. Guardrail ────────────────────────────────────────────────────────────
log "4/10 Bedrock Guardrail"
GR_NAME="${PREFIX}-safety"
GR_ID="$(aws bedrock list-guardrails --query "guardrails[?name=='$GR_NAME'].id | [0]" --output text 2>/dev/null || echo None)"
if [ -z "$GR_ID" ] || [ "$GR_ID" = "None" ]; then
  python3 - "$HERE/guardrail.json" "$GR_NAME" > "$WORK/guardrail.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
d["name"] = sys.argv[2]
print(json.dumps(d, ensure_ascii=False))
PY
  GR_ID="$(aws bedrock create-guardrail --cli-input-json "file://$WORK/guardrail.json" --query guardrailId --output text)"
  info "created $GR_ID"
fi
GR_VERSION="$(aws bedrock list-guardrails --guardrail-identifier "$GR_ID" --query "guardrails[?version!='DRAFT'] | sort_by(@,&version)[-1].version" --output text 2>/dev/null || echo None)"
if [ -z "$GR_VERSION" ] || [ "$GR_VERSION" = "None" ]; then
  GR_VERSION="$(aws bedrock create-guardrail-version --guardrail-identifier "$GR_ID" --description "beddy 2.0" --query version --output text)"
fi
info "guardrail $GR_ID v$GR_VERSION"
save GUARDRAIL_ID "$GR_ID"

# ── 5. Knowledge Base on S3 Vectors (guardian RAG over summaries) ───────────
KB_ID=""; KB_DS_ID=""
if [ "$ENABLE_KB" = "1" ]; then
  log "5/10 Bedrock Knowledge Base (S3 Vectors)"
  if ! aws s3vectors help >/dev/null 2>&1; then
    warn "이 CloudShell의 AWS CLI에 s3vectors 명령이 없습니다 — KB 없이 진행합니다 (보호자 질문 답변은 요약 없이 동작)."
  else
    VB="${PREFIX}-kb-vectors-${ACCOUNT}"
    IDX="${PREFIX}-summaries"
    EMBED_ARN="arn:aws:bedrock:${REGION}::foundation-model/amazon.titan-embed-text-v2:0"
    aws s3vectors get-vector-bucket --vector-bucket-name "$VB" >/dev/null 2>&1 || \
      aws s3vectors create-vector-bucket --vector-bucket-name "$VB" >/dev/null
    VB_ARN="$(aws s3vectors get-vector-bucket --vector-bucket-name "$VB" --query vectorBucket.vectorBucketArn --output text)"
    if ! aws s3vectors get-index --vector-bucket-name "$VB" --index-name "$IDX" >/dev/null 2>&1; then
      aws s3vectors create-index --vector-bucket-name "$VB" --index-name "$IDX" \
        --data-type float32 --dimension 1024 --distance-metric cosine \
        --metadata-configuration '{"nonFilterableMetadataKeys":["AMAZON_BEDROCK_TEXT","AMAZON_BEDROCK_METADATA"]}' >/dev/null
      sleep 5
    fi
    IDX_ARN="$(aws s3vectors get-index --vector-bucket-name "$VB" --index-name "$IDX" --query index.indexArn --output text)"
    KB_ROLE="${PREFIX}-kb-role"
    cat > "$WORK/kb-trust.json" <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"bedrock.amazonaws.com"},"Action":"sts:AssumeRole",
 "Condition":{"StringEquals":{"aws:SourceAccount":"$ACCOUNT"},"ArnLike":{"aws:SourceArn":"arn:aws:bedrock:${REGION}:${ACCOUNT}:knowledge-base/*"}}}]}
JSON
    aws iam get-role --role-name "$KB_ROLE" >/dev/null 2>&1 || \
      { aws iam create-role --role-name "$KB_ROLE" --assume-role-policy-document "file://$WORK/kb-trust.json" >/dev/null; sleep 8; }
    cat > "$WORK/kb-policy.json" <<JSON
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["s3:ListBucket"],"Resource":"arn:aws:s3:::${BUCKET}","Condition":{"StringLike":{"s3:prefix":["kb-summaries","kb-summaries/*"]}}},
 {"Effect":"Allow","Action":["s3:GetObject"],"Resource":"arn:aws:s3:::${BUCKET}/kb-summaries/*"},
 {"Effect":"Allow","Action":["bedrock:InvokeModel"],"Resource":["${EMBED_ARN}"]},
 {"Effect":"Allow","Action":["s3vectors:QueryVectors","s3vectors:GetVectors","s3vectors:PutVectors","s3vectors:DeleteVectors","s3vectors:GetIndex","s3vectors:ListIndexes","s3vectors:GetVectorBucket"],
  "Resource":["${VB_ARN}","${IDX_ARN}","${VB_ARN}/*"]}
]}
JSON
    aws iam put-role-policy --role-name "$KB_ROLE" --policy-name kb-access --policy-document "file://$WORK/kb-policy.json"
    KB_ROLE_ARN="$(aws iam get-role --role-name "$KB_ROLE" --query Role.Arn --output text)"
    sleep 10
    KB_NAME="${PREFIX}-child-summaries"
    KB_ID="$(aws bedrock-agent list-knowledge-bases --query "knowledgeBaseSummaries[?name=='$KB_NAME'].knowledgeBaseId | [0]" --output text)"
    if [ -z "$KB_ID" ] || [ "$KB_ID" = "None" ]; then
      KB_ID="$(aws bedrock-agent create-knowledge-base --name "$KB_NAME" \
        --description "Beddy privacy-safe child summaries (no raw chat)" \
        --role-arn "$KB_ROLE_ARN" \
        --knowledge-base-configuration "{\"type\":\"VECTOR\",\"vectorKnowledgeBaseConfiguration\":{\"embeddingModelArn\":\"$EMBED_ARN\",\"embeddingModelConfiguration\":{\"bedrockEmbeddingModelConfiguration\":{\"dimensions\":1024,\"embeddingDataType\":\"FLOAT32\"}}}}" \
        --storage-configuration "{\"type\":\"S3_VECTORS\",\"s3VectorsConfiguration\":{\"vectorBucketArn\":\"$VB_ARN\",\"indexArn\":\"$IDX_ARN\"}}" \
        --query knowledgeBase.knowledgeBaseId --output text)"
      sleep 8
    fi
    KB_DS_ID="$(aws bedrock-agent list-data-sources --knowledge-base-id "$KB_ID" --query "dataSourceSummaries[0].dataSourceId" --output text)"
    if [ -z "$KB_DS_ID" ] || [ "$KB_DS_ID" = "None" ]; then
      KB_DS_ID="$(aws bedrock-agent create-data-source --knowledge-base-id "$KB_ID" --name "${PREFIX}-kb-summaries-s3" \
        --data-source-configuration "{\"type\":\"S3\",\"s3Configuration\":{\"bucketArn\":\"arn:aws:s3:::${BUCKET}\",\"inclusionPrefixes\":[\"kb-summaries/\"]}}" \
        --query dataSource.dataSourceId --output text)"
    fi
    aws bedrock-agent start-ingestion-job --knowledge-base-id "$KB_ID" --data-source-id "$KB_DS_ID" >/dev/null 2>&1 || true
    info "kb=$KB_ID datasource=$KB_DS_ID"
    save KB_ID "$KB_ID"; save KB_DS_ID "$KB_DS_ID"; save KB_VECTOR_BUCKET "$VB"; save KB_ROLE "$KB_ROLE"
  fi
else
  log "5/10 Knowledge Base 건너뜀 (ENABLE_KB=0)"
fi

# ── 6. IAM role for the app server ──────────────────────────────────────────
log "6/10 서버 IAM 역할 ($ROLE)"
cat > "$WORK/ec2-trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
aws iam get-role --role-name "$ROLE" >/dev/null 2>&1 || \
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document "file://$WORK/ec2-trust.json" >/dev/null
cat > "$WORK/app-policy.json" <<JSON
{"Version":"2012-10-17","Statement":[
 {"Sid":"Bedrock","Effect":"Allow","Action":["bedrock:InvokeModel","bedrock:InvokeModelWithResponseStream","bedrock:Converse","bedrock:ConverseStream","bedrock:ApplyGuardrail","bedrock:Retrieve","bedrock:StartIngestionJob","bedrock:GetIngestionJob"],"Resource":"*"},
 {"Sid":"Table","Effect":"Allow","Action":["dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:DeleteItem","dynamodb:Query","dynamodb:Scan","dynamodb:BatchGetItem","dynamodb:BatchWriteItem","dynamodb:TransactWriteItems","dynamodb:DescribeTable"],"Resource":["arn:aws:dynamodb:${REGION}:${ACCOUNT}:table/${TABLE}","arn:aws:dynamodb:${REGION}:${ACCOUNT}:table/${TABLE}/index/*"]},
 {"Sid":"Media","Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::${BUCKET}/*"},
 {"Sid":"MediaList","Effect":"Allow","Action":["s3:ListBucket"],"Resource":"arn:aws:s3:::${BUCKET}"},
 {"Sid":"Secrets","Effect":"Allow","Action":["ssm:GetParameter","ssm:GetParameters","ssm:GetParametersByPath"],"Resource":"arn:aws:ssm:${REGION}:${ACCOUNT}:parameter${PARAM}*"},
 {"Sid":"Metrics","Effect":"Allow","Action":["cloudwatch:PutMetricData"],"Resource":"*"}
]}
JSON
aws iam put-role-policy --role-name "$ROLE" --policy-name app-access --policy-document "file://$WORK/app-policy.json"
aws iam attach-role-policy --role-name "$ROLE" --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
if ! aws iam get-instance-profile --instance-profile-name "$PROFILE" >/dev/null 2>&1; then
  aws iam create-instance-profile --instance-profile-name "$PROFILE" >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name "$PROFILE" --role-name "$ROLE"
  info "waiting for the instance profile to propagate…"
  sleep 15
fi
save ROLE "$ROLE"; save PROFILE "$PROFILE"

# ── 7. Source bundle → S3 ───────────────────────────────────────────────────
log "7/10 소스 묶음 업로드"
( cd "$ROOT" && zip -q -r "$WORK/source.zip" . \
    -x 'node_modules/*' '.next/*' '.git/*' '.data/*' '.claude/*' 'deploy/aws/.state.env' '*.log' )
aws s3 cp "$WORK/source.zip" "s3://$BUCKET/deploy/source.zip" --only-show-errors
info "s3://$BUCKET/deploy/source.zip ($(du -h "$WORK/source.zip" | cut -f1))"

# Runtime config for the container (non-secret) — read by the instance at boot / redeploy
cat > "$WORK/app.env" <<ENV
NODE_ENV=production
PERSISTENCE=dynamodb
AUTH_PROVIDER=dynamodb
BEDI_DDB_TABLE=${TABLE}
AWS_REGION=${REGION}
LLM_PROVIDER=bedrock
LLM_FALLBACK_TO_MOCK=false
BEDROCK_MODEL_ID=${CHAT_MODEL}
BEDROCK_MODEL_ID_CHAT=${CHAT_MODEL}
BEDROCK_MODEL_ID_QUALITY=${QUALITY_MODEL}
BEDROCK_GUARDRAIL_ID=${GR_ID}
BEDROCK_GUARDRAIL_VERSION=${GR_VERSION}
BEDROCK_KB_ID=${KB_ID}
BEDROCK_KB_DATA_SOURCE_ID=${KB_DS_ID}
BEDROCK_IMAGE_MODEL_ID=stability.stable-image-core-v1:1
BEDROCK_IMAGE_REGION=${IMAGE_REGION}
AVATAR_S3_BUCKET=${BUCKET}
AVATAR_S3_REGION=${REGION}
AI_DAILY_LLM_CAP=${AI_DAILY_LLM_CAP}
AI_DAILY_IMAGE_CAP=${AI_DAILY_IMAGE_CAP}
BEDDY_METRICS=1
ENV
aws s3 cp "$WORK/app.env" "s3://$BUCKET/deploy/app.env" --only-show-errors

# ── 8. Network + server ─────────────────────────────────────────────────────
log "8/10 서버 (EC2 $INSTANCE_TYPE, Docker)"
VPC_ID="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"
if [ -z "$VPC_ID" ] || [ "$VPC_ID" = "None" ]; then
  aws ec2 create-default-vpc >/dev/null
  VPC_ID="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"
fi
SG_ID="$(aws ec2 describe-security-groups --filters Name=group-name,Values="$SG_NAME" Name=vpc-id,Values="$VPC_ID" --query 'SecurityGroups[0].GroupId' --output text)"
if [ -z "$SG_ID" ] || [ "$SG_ID" = "None" ]; then
  SG_ID="$(aws ec2 create-security-group --group-name "$SG_NAME" --description "Beddy app: HTTP from CloudFront only" --vpc-id "$VPC_ID" --query GroupId --output text)"
  CF_PL="$(aws ec2 describe-managed-prefix-lists --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing --query 'PrefixLists[0].PrefixListId' --output text)"
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
    --ip-permissions "IpProtocol=tcp,FromPort=80,ToPort=80,PrefixListIds=[{PrefixListId=$CF_PL,Description=CloudFront}]" >/dev/null
fi
save SG_ID "$SG_ID"

AMI_ID="$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 --query Parameter.Value --output text)"
sed -e "s|__BUCKET__|$BUCKET|g" -e "s|__REGION__|$REGION|g" -e "s|__PARAM__|$PARAM|g" \
  "$HERE/user-data.sh" > "$WORK/user-data.sh"

INSTANCE_ID="$(aws ec2 describe-instances --filters Name=tag:Name,Values="${PREFIX}-app" Name=instance-state-name,Values=pending,running,stopped \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)"
if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
  INSTANCE_ID="$(aws ec2 run-instances --image-id "$AMI_ID" --instance-type "$INSTANCE_TYPE" \
    --iam-instance-profile "Name=$PROFILE" --security-group-ids "$SG_ID" \
    --metadata-options HttpTokens=required,HttpPutResponseHopLimit=2,HttpEndpoint=enabled \
    --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=30,VolumeType=gp3,Encrypted=true}' \
    --user-data "file://$WORK/user-data.sh" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${PREFIX}-app},{Key=project,Value=${PREFIX}}]" \
    --query 'Instances[0].InstanceId' --output text)"
  info "launched $INSTANCE_ID"
else
  info "reusing $INSTANCE_ID (코드 갱신은 deploy/aws/redeploy.sh)"
  aws ec2 start-instances --instance-ids "$INSTANCE_ID" >/dev/null 2>&1 || true
fi
save INSTANCE_ID "$INSTANCE_ID"
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
PUBLIC_DNS="$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query 'Reservations[0].Instances[0].PublicDnsName' --output text)"
info "origin $PUBLIC_DNS"

# ── 9. CloudFront (HTTPS) ───────────────────────────────────────────────────
log "9/10 HTTPS 주소 (CloudFront)"
CF_ID="$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='${PREFIX}'].Id | [0]" --output text 2>/dev/null || echo None)"
if [ -z "$CF_ID" ] || [ "$CF_ID" = "None" ]; then
  cat > "$WORK/cf.json" <<JSON
{
  "CallerReference": "${PREFIX}-$(date +%s)",
  "Comment": "${PREFIX}",
  "Enabled": true,
  "HttpVersion": "http2",
  "PriceClass": "PriceClass_200",
  "Origins": {"Quantity": 1, "Items": [{
    "Id": "app", "DomainName": "${PUBLIC_DNS}",
    "CustomOriginConfig": {"HTTPPort": 80, "HTTPSPort": 443, "OriginProtocolPolicy": "http-only",
      "OriginReadTimeout": 60, "OriginKeepaliveTimeout": 5,
      "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]}}
  }]},
  "DefaultCacheBehavior": {
    "TargetOriginId": "app",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {"Quantity": 7, "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET","HEAD"]}},
    "Compress": false,
    "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
    "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3"
  }
}
JSON
  CF_ID="$(aws cloudfront create-distribution --distribution-config "file://$WORK/cf.json" --query Distribution.Id --output text)"
  info "created $CF_ID"
fi
CF_DOMAIN="$(aws cloudfront get-distribution --id "$CF_ID" --query Distribution.DomainName --output text)"
save CF_ID "$CF_ID"; save CF_DOMAIN "$CF_DOMAIN"
APP_URL="https://${CF_DOMAIN}"
aws ssm put-parameter --name "$PARAM/APP_URL" --type String --value "$APP_URL" --overwrite >/dev/null

# ── 10. Wait for the app, seed accounts ─────────────────────────────────────
log "10/10 앱 기동 대기 (첫 빌드 5~8분) + 데모 계정 만들기"
health_cmd() {
  aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name AWS-RunShellScript \
    --parameters 'commands=["curl -s -o /dev/null -w %{http_code} http://localhost/api/health || true"]' \
    --query Command.CommandId --output text 2>/dev/null
}
ok=0
for i in $(seq 1 40); do
  sleep 20
  CMD_ID="$(health_cmd || true)"
  [ -z "$CMD_ID" ] && { info "waiting for SSM agent… ($i)"; continue; }
  sleep 4
  OUT="$(aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --query StandardOutputContent --output text 2>/dev/null || true)"
  if [ "$OUT" = "200" ]; then ok=1; break; fi
  info "building… ($i/40, health=$OUT)"
done
[ "$ok" = "1" ] || warn "앱 상태 확인 시간 초과 — 몇 분 뒤 deploy/aws/status.sh 로 다시 확인하세요."

if command -v node >/dev/null 2>&1; then
  ( cd "$ROOT" && npm install --no-save --no-audit --no-fund bcryptjs@3 @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb >/dev/null 2>&1 ) || true
  get() { aws ssm get-parameter --name "$PARAM/$1" --with-decryption --query Parameter.Value --output text; }
  ( cd "$ROOT" && BEDI_DDB_TABLE="$TABLE" AWS_REGION="$REGION" \
      DEMO_CHILD_PASSWORD="$(get DEMO_CHILD_PASSWORD)" DEMO_GUARDIAN_PASSWORD="$(get DEMO_GUARDIAN_PASSWORD)" \
      JUDGE_PASSWORD="$(get JUDGE_PASSWORD)" node scripts/seed/seed-dynamo-users.js ) || warn "데모 계정 생성 실패 — scripts/seed 로그를 확인하세요."
else
  warn "node가 없어 데모 계정을 만들지 못했습니다."
fi

log "완료"
cat <<DONE

  주소:            ${APP_URL}
  (CloudFront 배포가 전 세계에 퍼지는 데 5~10분 걸릴 수 있어요)

  데모·심사 계정 비밀번호 확인:
    aws ssm get-parameters-by-path --path ${PARAM} --with-decryption \\
      --query "Parameters[?contains(Name,'PASSWORD')].[Name,Value]" --output table

  코드 갱신:   bash deploy/aws/redeploy.sh
  상태 확인:   bash deploy/aws/status.sh
  전부 삭제:   bash deploy/aws/teardown.sh
DONE
