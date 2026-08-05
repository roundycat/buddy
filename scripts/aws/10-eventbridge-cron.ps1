# STEP 4: EventBridge dawn cron → API Destination → /api/cron/daily
# Schedule: 05:00 KST = 20:00 UTC previous day (cron 0 20 * * ? *)
$ErrorActionPreference = "Stop"
$aws = if (Get-Command aws -ErrorAction SilentlyContinue) { "aws" } else { "C:\Program Files\Amazon\AWSCLIV2\aws.exe" }

$Region = "us-east-1"
$Account = (& $aws sts get-caller-identity --query Account --output text).Trim()
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$env:AWS_DEFAULT_REGION = $Region

function Get-EnvVal([string]$key, [string]$fallback = "") {
  $line = Get-Content (Join-Path $Root ".env.local") -ErrorAction SilentlyContinue |
    Where-Object { $_ -match "^$([regex]::Escape($key))=" } | Select-Object -First 1
  if (-not $line) { return $fallback }
  return $line.Substring($key.Length + 1).Trim()
}

$AppUrl = Get-EnvVal "NEXT_PUBLIC_APP_URL" "https://d36nmab92hbhe2.cloudfront.net"
$AppUrl = $AppUrl.TrimEnd("/")
$CronUrl = "$AppUrl/api/cron/daily"

$CronSecret = Get-EnvVal "CRON_SECRET" ""
if (-not $CronSecret) {
  # Prefer Secrets Manager (authoritative for ECS)
  $secretRaw = & $aws secretsmanager get-secret-value --secret-id bedi/app --region $Region --query SecretString --output text 2>$null
  if ($secretRaw) {
    try {
      $obj = $secretRaw | ConvertFrom-Json
      $CronSecret = [string]$obj.CRON_SECRET
    } catch {}
  }
}
if (-not $CronSecret) {
  throw "CRON_SECRET missing — set in .env.local or run 08-secrets.ps1 first"
}

$ConnName = "bedi-cron-connection"
$DestName = "bedi-cron-daily"
$RuleName = "bedi-dawn-daily-batch"
$RoleName = "BediEventBridgeApiDestRole"
$AlarmName = "Beddy-CronDailyFailures"
$TopicName = "bedi-ops-alerts"

Write-Host "Account=$Account Region=$Region"
Write-Host "CronUrl=$CronUrl"

# Enable DynamoDB TTL attribute `ttl` on BediApp (coarse locations etc.)
$Table = "BediApp"
$ttlDesc = & $aws dynamodb describe-time-to-live --table-name $Table --region $Region --query "TimeToLiveDescription.TimeToLiveStatus" --output text 2>$null
if ($ttlDesc -ne "ENABLED" -and $ttlDesc -ne "ENABLING") {
  & $aws dynamodb update-time-to-live --table-name $Table --region $Region `
    --time-to-live-specification "Enabled=true,AttributeName=ttl" | Out-Null
  Write-Host "Enabled DynamoDB TTL on $Table (attr=ttl)"
} else {
  Write-Host "DynamoDB TTL already $ttlDesc"
}

# Connection (API key header)
$connArn = (& $aws events describe-connection --name $ConnName --region $Region --query ConnectionArn --output text 2>$null)
if (-not $connArn -or $connArn -eq "None") {
  $connArn = (& $aws events create-connection `
    --name $ConnName `
    --authorization-type API_KEY `
    --auth-parameters "ApiKeyAuthParameters={ApiKeyName=x-bedi-cron-secret,ApiKeyValue=$CronSecret}" `
    --region $Region `
    --query ConnectionArn --output text).Trim()
  Write-Host "Created connection $connArn"
} else {
  & $aws events update-connection `
    --name $ConnName `
    --authorization-type API_KEY `
    --auth-parameters "ApiKeyAuthParameters={ApiKeyName=x-bedi-cron-secret,ApiKeyValue=$CronSecret}" `
    --region $Region | Out-Null
  Write-Host "Updated connection $connArn"
}

# API Destination
$destArn = (& $aws events describe-api-destination --name $DestName --region $Region --query ApiDestinationArn --output text 2>$null)
if (-not $destArn -or $destArn -eq "None") {
  $destArn = (& $aws events create-api-destination `
    --name $DestName `
    --connection-arn $connArn `
    --invocation-endpoint $CronUrl `
    --http-method POST `
    --invocation-rate-limit-per-second 1 `
    --region $Region `
    --query ApiDestinationArn --output text).Trim()
  Write-Host "Created API destination $destArn"
} else {
  & $aws events update-api-destination `
    --name $DestName `
    --connection-arn $connArn `
    --invocation-endpoint $CronUrl `
    --http-method POST `
    --invocation-rate-limit-per-second 1 `
    --region $Region | Out-Null
  $destArn = (& $aws events describe-api-destination --name $DestName --region $Region --query ApiDestinationArn --output text).Trim()
  Write-Host "Updated API destination $destArn"
}

# IAM role for EventBridge → API Destination
$trust = Join-Path $env:TEMP "bedi-eb-trust.json"
@"
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"events.amazonaws.com"},"Action":"sts:AssumeRole"}]}
"@ | Set-Content $trust -Encoding ascii

cmd /c "`"$aws`" iam get-role --role-name $RoleName >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$trust" | Out-Null
}
$rolePolicy = Join-Path $env:TEMP "bedi-eb-api-dest.json"
@"
{"Version":"2012-10-17","Statement":[
{"Effect":"Allow","Action":["events:InvokeApiDestination"],"Resource":"$destArn"}
]}
"@ | Set-Content $rolePolicy -Encoding ascii
& $aws iam put-role-policy --role-name $RoleName --policy-name BediInvokeCronDest --policy-document "file://$rolePolicy" | Out-Null
$RoleArn = (& $aws iam get-role --role-name $RoleName --query Role.Arn --output text).Trim()
Start-Sleep -Seconds 8

# Rule: 05:00 KST = 20:00 UTC
$ruleArn = (& $aws events put-rule `
  --name $RuleName `
  --schedule-expression "cron(0 20 * * ? *)" `
  --state ENABLED `
  --description "Beddy dawn daily batch (05:00 KST)" `
  --region $Region `
  --query RuleArn --output text).Trim()

$targets = Join-Path $env:TEMP "bedi-eb-targets.json"
@"
[{"Id":"1","Arn":"$destArn","RoleArn":"$RoleArn","HttpParameters":{"HeaderParameters":{},"QueryStringParameters":{},"PathParameterValues":[]},"RetryPolicy":{"MaximumRetryAttempts":2,"MaximumEventAge":3600},"DeadLetterConfig":{}}]
"@ | Set-Content $targets -Encoding ascii

# DeadLetterConfig empty object may fail — use minimal targets without DLQ
@"
[{"Id":"BeddyCronDaily","Arn":"$destArn","RoleArn":"$RoleArn","RetryPolicy":{"MaximumRetryAttempts":2,"MaximumEventAgeInSeconds":3600}}]
"@ | Set-Content $targets -Encoding ascii

& $aws events put-targets --rule $RuleName --targets "file://$targets" --region $Region | Out-Null
Write-Host "Rule=$ruleArn → $DestName"

# Alarm on failed invocations (AWS/Events InvocationsFailedToBeSentToTarget / or FailedInvocations)
$TopicArn = (& $aws sns create-topic --name $TopicName --query TopicArn --output text).Trim()
& $aws cloudwatch put-metric-alarm `
  --alarm-name $AlarmName `
  --alarm-description "EventBridge rule $RuleName failed invocations >= 1" `
  --namespace "AWS/Events" `
  --metric-name FailedInvocations `
  --dimensions "Name=RuleName,Value=$RuleName" `
  --statistic Sum `
  --period 300 `
  --evaluation-periods 1 `
  --threshold 1 `
  --comparison-operator GreaterThanOrEqualToThreshold `
  --treat-missing-data notBreaching `
  --alarm-actions $TopicArn `
  --region $Region | Out-Null

Write-Host "Alarm=$AlarmName"
Write-Host "Manual smoke: curl -X POST `"$CronUrl`" -H `"x-bedi-cron-secret: ***`""
Write-Host "DONE"
