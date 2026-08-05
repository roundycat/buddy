# Beddy CloudWatch dashboard + alarms (STEP 2)
$ErrorActionPreference = "Stop"
$aws = if (Get-Command aws -ErrorAction SilentlyContinue) { "aws" } else { "C:\Program Files\Amazon\AWSCLIV2\aws.exe" }

$Region = "us-east-1"
$Account = (& $aws sts get-caller-identity --query Account --output text).Trim()
$Namespace = "Beddy"
$Dashboard = "Beddy-Observability"
$TaskRole = "BediEcsTaskRole"
$TopicName = "bedi-ops-alerts"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$env:AWS_DEFAULT_REGION = $Region

Write-Host "Account=$Account Region=$Region"

$taskPolicy = Join-Path $env:TEMP "bedi-ecs-task-policy-obs.json"
$Bucket = "bedi-codebuild-$Account-$Region"
@"
{"Version":"2012-10-17","Statement":[
{"Effect":"Allow","Action":["dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:DeleteItem","dynamodb:Query","dynamodb:Scan","dynamodb:DescribeTable"],"Resource":"arn:aws:dynamodb:${Region}:${Account}:table/BediApp"},
{"Effect":"Allow","Action":["bedrock:InvokeModel","bedrock:InvokeModelWithResponseStream","bedrock:Converse","bedrock:ConverseStream"],"Resource":"*"},
{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::${Bucket}/avatars/*","arn:aws:s3:::${Bucket}/schedule-images/*","arn:aws:s3:::${Bucket}/photos/*"]},
{"Effect":"Allow","Action":["cloudwatch:PutMetricData"],"Resource":"*","Condition":{"StringEquals":{"cloudwatch:namespace":"Beddy"}}}
]}
"@ | Set-Content $taskPolicy -Encoding ascii
cmd /c "`"$aws`" iam get-role --role-name $TaskRole >nul 2>&1"
if ($LASTEXITCODE -eq 0) {
  & $aws iam put-role-policy --role-name $TaskRole --policy-name BediEcsTaskAccess --policy-document "file://$taskPolicy" | Out-Null
  Write-Host "Updated IAM $TaskRole"
}

$TopicArn = (& $aws sns create-topic --name $TopicName --query TopicArn --output text).Trim()
Write-Host "SNS=$TopicArn"

& $aws cloudwatch put-metric-alarm `
  --alarm-name "Beddy-LlmErrorRate" `
  --alarm-description "LLM Errors sum >= 3 in 5 minutes (conversation.chat)" `
  --namespace $Namespace `
  --metric-name Errors `
  --dimensions "Name=Feature,Value=conversation.chat" `
  --statistic Sum `
  --period 300 `
  --evaluation-periods 1 `
  --threshold 3 `
  --comparison-operator GreaterThanOrEqualToThreshold `
  --treat-missing-data notBreaching `
  --alarm-actions $TopicArn | Out-Null

& $aws cloudwatch put-metric-alarm `
  --alarm-name "Beddy-LlmLatencyP95" `
  --alarm-description "conversation.chat BedrockLatencyMs average > 8000ms (p95 proxy)" `
  --namespace $Namespace `
  --metric-name BedrockLatencyMs `
  --dimensions "Name=Feature,Value=conversation.chat" `
  --statistic Average `
  --period 300 `
  --evaluation-periods 1 `
  --threshold 8000 `
  --comparison-operator GreaterThanThreshold `
  --treat-missing-data notBreaching `
  --alarm-actions $TopicArn | Out-Null

Write-Host "Alarms ready"

$dashBodyPath = Join-Path $PSScriptRoot "bedi-observability-dashboard.json"
$bodyRaw = [System.IO.File]::ReadAllText($dashBodyPath).Trim()
$inputFile = Join-Path $env:TEMP "bedi-cw-put-dashboard.json"
# Escape body as JSON string
$bodyEscaped = ($bodyRaw | ConvertTo-Json -Compress)
$cliJson = "{`"DashboardName`":`"$Dashboard`",`"DashboardBody`":$bodyEscaped}"
[System.IO.File]::WriteAllText($inputFile, $cliJson, [System.Text.UTF8Encoding]::new($false))
& $aws cloudwatch put-dashboard --cli-input-json "file://$inputFile" | Out-Null

Write-Host "Dashboard: https://$Region.console.aws.amazon.com/cloudwatch/home?region=$Region#dashboards:name=$Dashboard"
Write-Host "DONE"
