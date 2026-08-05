# Package source → CodeBuild (Docker in AWS) → ECR → App Runner
# Local Docker is NOT required.
$ErrorActionPreference = "Stop"
$aws = if (Get-Command aws -ErrorAction SilentlyContinue) { "aws" } else { "C:\Program Files\Amazon\AWSCLIV2\aws.exe" }

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-west-2" }
$Account = (& $aws sts get-caller-identity --query Account --output text).Trim()
$Repo = "bedi-app"
$Bucket = "bedi-codebuild-$Account-$Region"
$Project = "bedi-app-build"
$Service = "bedi-app"
$InstanceRole = "BediAppRunnerInstanceRole"
$BuildRole = "BediCodeBuildRole"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

Write-Host "Account=$Account Region=$Region Root=$Root"

function AwsOk { param([scriptblock]$Block) & $Block; if ($LASTEXITCODE -ne 0) { throw "AWS command failed: $Block" } }

# ECR
cmd /c "`"$aws`" ecr describe-repositories --repository-names $Repo --region $Region >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws ecr create-repository --repository-name $Repo --region $Region | Out-Null
  Write-Host "Created ECR $Repo"
}

# S3
cmd /c "`"$aws`" s3api head-bucket --bucket $Bucket >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws s3api create-bucket --bucket $Bucket --region $Region --create-bucket-configuration LocationConstraint=$Region | Out-Null
  Write-Host "Created S3 $Bucket"
}

# CodeBuild role
$TrustPath = Join-Path $env:TEMP "bedi-cb-trust.json"
$PolicyPath = Join-Path $env:TEMP "bedi-cb-policy.json"
@'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]}
'@ | Set-Content $TrustPath -Encoding ascii
@"
{"Version":"2012-10-17","Statement":[
{"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],"Resource":"*"},
{"Effect":"Allow","Action":["s3:GetObject","s3:GetObjectVersion"],"Resource":"arn:aws:s3:::${Bucket}/*"},
{"Effect":"Allow","Action":["ecr:GetAuthorizationToken"],"Resource":"*"},
{"Effect":"Allow","Action":["ecr:BatchCheckLayerAvailability","ecr:CompleteLayerUpload","ecr:InitiateLayerUpload","ecr:PutImage","ecr:UploadLayerPart","ecr:BatchGetImage","ecr:GetDownloadUrlForLayer"],"Resource":"arn:aws:ecr:${Region}:${Account}:repository/${Repo}"}
]}
"@ | Set-Content $PolicyPath -Encoding ascii

cmd /c "`"$aws`" iam get-role --role-name $BuildRole >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws iam create-role --role-name $BuildRole --assume-role-policy-document "file://$TrustPath" | Out-Null
  Start-Sleep -Seconds 10
}
& $aws iam put-role-policy --role-name $BuildRole --policy-name BediCodeBuildAccess --policy-document "file://$PolicyPath" | Out-Null
$BuildRoleArn = (& $aws iam get-role --role-name $BuildRole --query Role.Arn --output text).Trim()

# CodeBuild project via full JSON
$ProjectJson = @{
  name = $Project
  source = @{
    type = "S3"
    location = "$Bucket/src/bedi-source.zip"
  }
  artifacts = @{ type = "NO_ARTIFACTS" }
  environment = @{
    type = "LINUX_CONTAINER"
    image = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    computeType = "BUILD_GENERAL1_MEDIUM"
    privilegedMode = $true
    environmentVariables = @(
      @{ name = "AWS_DEFAULT_REGION"; value = $Region; type = "PLAINTEXT" }
      @{ name = "AWS_ACCOUNT_ID"; value = $Account; type = "PLAINTEXT" }
      @{ name = "IMAGE_REPO_NAME"; value = $Repo; type = "PLAINTEXT" }
    )
  }
  serviceRole = $BuildRoleArn
  timeoutInMinutes = 45
}
$ProjectPath = Join-Path $env:TEMP "bedi-cb-project.json"
($ProjectJson | ConvertTo-Json -Depth 8 -Compress) | Set-Content $ProjectPath -Encoding ascii

$existingProj = & $aws codebuild batch-get-projects --names $Project --region $Region --query "projects[0].name" --output text 2>$null
if ($existingProj -and $existingProj -ne "None") {
  # update-project needs name + fields
  & $aws codebuild update-project --cli-input-json "file://$ProjectPath" --region $Region | Out-Null
  Write-Host "Updated CodeBuild $Project"
} else {
  & $aws codebuild create-project --cli-input-json "file://$ProjectPath" --region $Region | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "create-project failed" }
  Write-Host "Created CodeBuild $Project"
}

# Zip source with tar (Compress-Archive often drops nested app trees)
$Zip = Join-Path $env:TEMP "bedi-source.zip"
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Write-Host "Zipping with tar..."
Push-Location $Root
# Windows tar supports zip via -a
& tar -a -c -f $Zip `
  --exclude=node_modules `
  --exclude=.next `
  --exclude=.data `
  --exclude=.git `
  --exclude=.cursor `
  --exclude=scripts/aws/last-deploy-url.txt `
  .
Pop-Location
# Sanity: ensure src/app exists in archive
& tar -tf $Zip | Select-String -Pattern "^(\./)?src/app/" | Select-Object -First 3 | ForEach-Object { Write-Host "zip has $_" }
& $aws s3 cp $Zip "s3://$Bucket/src/bedi-source.zip" --region $Region | Out-Null
Write-Host "Uploaded source zip"

$BuildId = (& $aws codebuild start-build --project-name $Project --region $Region --query build.id --output text).Trim()
if (-not $BuildId -or $BuildId -eq "None") { throw "start-build failed" }
Write-Host "Build: $BuildId"

do {
  Start-Sleep -Seconds 25
  $status = (& $aws codebuild batch-get-builds --ids $BuildId --region $Region --query "builds[0].buildStatus" --output text).Trim()
  Write-Host "  buildStatus=$status"
} while ($status -eq "IN_PROGRESS" -or $status -eq "PENDING")

if ($status -ne "SUCCEEDED") {
  & $aws codebuild batch-get-builds --ids $BuildId --region $Region --query "builds[0].phases" | Out-Host
  throw "CodeBuild $status"
}

$Image = "$Account.dkr.ecr.$Region.amazonaws.com/${Repo}:latest"
$InstanceRoleArn = (& $aws iam get-role --role-name $InstanceRole --query Role.Arn --output text).Trim()

function Get-EnvVal([string]$key, [string]$fallback = "") {
  $file = Join-Path $Root ".env.local"
  $line = Get-Content $file -ErrorAction SilentlyContinue | Where-Object { $_ -match "^$([regex]::Escape($key))=" } | Select-Object -First 1
  if (-not $line) { return $fallback }
  return $line.Substring($key.Length + 1).Trim()
}

$EcrAccessRole = "BediAppRunnerEcrAccessRole"
$EcrTrust = Join-Path $env:TEMP "bedi-ecr-trust.json"
@'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"build.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]}
'@ | Set-Content $EcrTrust -Encoding ascii
cmd /c "`"$aws`" iam get-role --role-name $EcrAccessRole >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws iam create-role --role-name $EcrAccessRole --assume-role-policy-document "file://$EcrTrust" | Out-Null
  & $aws iam attach-role-policy --role-name $EcrAccessRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess | Out-Null
  Start-Sleep -Seconds 12
}
$EcrAccessRoleArn = (& $aws iam get-role --role-name $EcrAccessRole --query Role.Arn --output text).Trim()

# Build runtime env map (omit empty)
$Runtime = [ordered]@{
  PERSISTENCE = "dynamodb"
  BEDI_DDB_TABLE = "BediApp"
  AWS_REGION = $Region
  LLM_PROVIDER = (Get-EnvVal "LLM_PROVIDER" "openai")
  LLM_FALLBACK_TO_MOCK = "true"
  BEDROCK_MODEL_ID = (Get-EnvVal "BEDROCK_MODEL_ID" "us.anthropic.claude-haiku-4-5-20251001-v1:0")
  AUTH_SESSION_SECRET = (Get-EnvVal "AUTH_SESSION_SECRET" "bedi-prod-change-me")
  OPENAI_MODEL = (Get-EnvVal "OPENAI_MODEL" "gpt-4o-mini")
  OPENAI_BASE_URL = (Get-EnvVal "OPENAI_BASE_URL" "https://api.openai.com/v1")
}
$oak = Get-EnvVal "OPENAI_API_KEY" ""
if ($oak) { $Runtime.OPENAI_API_KEY = $oak }

$ExistingArn = (& $aws apprunner list-services --region $Region --query "ServiceSummaryList[?ServiceName=='$Service'].ServiceArn | [0]" --output text).Trim()

# Use Python/json via node to emit AWS-shaped JSON (avoid PS ConvertTo-Json quirks)
$payload = @{
  serviceName = $Service
  existingArn = if ($ExistingArn -and $ExistingArn -ne "None") { $ExistingArn } else { $null }
  image = $Image
  ecrAccessRoleArn = $EcrAccessRoleArn
  instanceRoleArn = $InstanceRoleArn
  runtime = $Runtime
}
$payloadPath = Join-Path $env:TEMP "bedi-apprunner-payload.json"
($payload | ConvertTo-Json -Depth 5 -Compress) | Set-Content $payloadPath -Encoding utf8
# Strip BOM for Node JSON.parse
$raw = [System.IO.File]::ReadAllText($payloadPath)
[System.IO.File]::WriteAllText($payloadPath, $raw.TrimStart([char]0xFEFF))

$nodeHelper = @'
const fs = require("fs");
const p = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const imageConfig = {
  Port: "3000",
  RuntimeEnvironmentVariables: p.runtime
};
const source = {
  AuthenticationConfiguration: { AccessRoleArn: p.ecrAccessRoleArn },
  AutoDeploymentsEnabled: false,
  ImageRepository: {
    ImageIdentifier: p.image,
    ImageRepositoryType: "ECR",
    ImageConfiguration: imageConfig
  }
};
const instance = {
  Cpu: "1024",
  Memory: "2048",
  InstanceRoleArn: p.instanceRoleArn
};
if (p.existingArn) {
  fs.writeFileSync(process.argv[3], JSON.stringify({
    ServiceArn: p.existingArn,
    SourceConfiguration: source,
    InstanceConfiguration: instance
  }));
  fs.writeFileSync(process.argv[4], "update");
} else {
  fs.writeFileSync(process.argv[3], JSON.stringify({
    ServiceName: p.serviceName,
    SourceConfiguration: source,
    InstanceConfiguration: instance,
    HealthCheckConfiguration: {
      Protocol: "HTTP",
      Path: "/login",
      Interval: 10,
      Timeout: 5,
      HealthyThreshold: 1,
      UnhealthyThreshold: 5
    }
  }));
  fs.writeFileSync(process.argv[4], "create");
}
'@
$helperPath = Join-Path $env:TEMP "bedi-apprunner-helper.js"
$outJson = Join-Path $env:TEMP "bedi-apprunner-cli.json"
$modeFile = Join-Path $env:TEMP "bedi-apprunner-mode.txt"
Set-Content $helperPath -Value $nodeHelper -Encoding utf8
node $helperPath $payloadPath $outJson $modeFile
$mode = (Get-Content $modeFile -Raw).Trim()

if ($mode -eq "update") {
  Write-Host "Updating App Runner..."
  & $aws apprunner update-service --cli-input-json "file://$outJson" --region $Region | Out-Null
  $ServiceArn = $ExistingArn
} else {
  Write-Host "Creating App Runner..."
  $ServiceArn = (& $aws apprunner create-service --cli-input-json "file://$outJson" --region $Region --query Service.ServiceArn --output text).Trim()
}

Write-Host "Waiting for RUNNING..."
for ($i = 0; $i -lt 80; $i++) {
  Start-Sleep -Seconds 15
  $st = (& $aws apprunner describe-service --service-arn $ServiceArn --region $Region --query "Service.Status" --output text).Trim()
  $url = (& $aws apprunner describe-service --service-arn $ServiceArn --region $Region --query "Service.ServiceUrl" --output text).Trim()
  Write-Host "  status=$st url=$url"
  if ($st -eq "RUNNING") {
    Write-Host "Deployed: https://$url"
    Set-Content (Join-Path $Root "scripts\aws\last-deploy-url.txt") "https://$url" -Encoding ascii
    exit 0
  }
  if ($st -match "FAILED|DELETED") { throw "App Runner $st" }
}
throw "Timed out waiting for App Runner"
