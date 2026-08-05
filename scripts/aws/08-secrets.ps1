# STEP 5-3: Secrets Manager for Beddy ECS secrets
$ErrorActionPreference = "Stop"
$aws = if (Get-Command aws -ErrorAction SilentlyContinue) { "aws" } else { "C:\Program Files\Amazon\AWSCLIV2\aws.exe" }
$Region = "us-east-1"
$Account = (& $aws sts get-caller-identity --query Account --output text).Trim()
$SecretName = "bedi/app"
$ExecRole = "BediEcsTaskExecutionRole"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$env:AWS_DEFAULT_REGION = $Region

function Get-EnvVal([string]$key, [string]$fallback = "") {
  $line = Get-Content (Join-Path $Root ".env.local") -ErrorAction SilentlyContinue |
    Where-Object { $_ -match "^$([regex]::Escape($key))=" } | Select-Object -First 1
  if (-not $line) { return $fallback }
  return $line.Substring($key.Length + 1).Trim()
}

$session = Get-EnvVal "AUTH_SESSION_SECRET" "bedi-prod-change-me"
$openai = Get-EnvVal "OPENAI_API_KEY" ""
$pgPass = Get-EnvVal "PGPASSWORD" ""
$cron = Get-EnvVal "CRON_SECRET" ""
if (-not $cron) {
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $bytes = New-Object byte[] 32
  $rng.GetBytes($bytes)
  $cron = ([Convert]::ToBase64String($bytes) -replace '[+/=]', '')
  Write-Host "Generated CRON_SECRET (also write to .env.local for local cron tests)"
}

$secretObj = @{
  AUTH_SESSION_SECRET = $session
  OPENAI_API_KEY = $openai
  PGPASSWORD = $pgPass
  CRON_SECRET = $cron
}
$secretJson = $secretObj | ConvertTo-Json -Compress
$secretFile = Join-Path $env:TEMP "bedi-secret.json"
[System.IO.File]::WriteAllText($secretFile, $secretJson, [System.Text.UTF8Encoding]::new($false))

cmd /c "`"$aws`" secretsmanager describe-secret --secret-id $SecretName --region $Region >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  $arn = (& $aws secretsmanager create-secret --name $SecretName --secret-string "file://$secretFile" --region $Region --query ARN --output text).Trim()
  Write-Host "Created secret $arn"
} else {
  & $aws secretsmanager put-secret-value --secret-id $SecretName --secret-string "file://$secretFile" --region $Region | Out-Null
  $arn = (& $aws secretsmanager describe-secret --secret-id $SecretName --region $Region --query ARN --output text).Trim()
  Write-Host "Updated secret $arn"
}

# Strip random suffix for ECS valueFrom with JSON keys — use full ARN without version
# ECS wants: arn:...:secret:bedi/app-XXXX:AUTH_SESSION_SECRET::
$secretArn = $arn

$policy = Join-Path $env:TEMP "bedi-exec-secrets.json"
@"
{"Version":"2012-10-17","Statement":[
{"Effect":"Allow","Action":["secretsmanager:GetSecretValue"],"Resource":"$secretArn"},
{"Effect":"Allow","Action":["kms:Decrypt"],"Resource":"*","Condition":{"StringEquals":{"kms:ViaService":"secretsmanager.${Region}.amazonaws.com"}}}
]}
"@ | Set-Content $policy -Encoding ascii
& $aws iam put-role-policy --role-name $ExecRole --policy-name BediSecretsAccess --policy-document "file://$policy" | Out-Null
Write-Host "Execution role can read $SecretName"
Write-Host "SECRET_ARN=$secretArn"
Set-Content (Join-Path $PSScriptRoot "last-secret-arn.txt") $secretArn -Encoding ascii
