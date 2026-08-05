# Bedi → us-east-1 ECS Fargate + ALB (App Runner 대체)
# Local Docker 불필요. CodeBuild가 이미지 빌드 후 ECR 푸시.
$ErrorActionPreference = "Stop"
$aws = if (Get-Command aws -ErrorAction SilentlyContinue) { "aws" } else { "C:\Program Files\Amazon\AWSCLIV2\aws.exe" }

$Region = "us-east-1"
$Account = (& $aws sts get-caller-identity --query Account --output text).Trim()
$Repo = "bedi-app"
$Bucket = "bedi-codebuild-$Account-$Region"
$Project = "bedi-app-build-east1"
$Cluster = "bedi-cluster"
$Service = "bedi-service"
$TaskFamily = "bedi-app"
$LogGroup = "/ecs/bedi-app"
$ExecRole = "BediEcsTaskExecutionRole"
$TaskRole = "BediEcsTaskRole"
$BuildRole = "BediCodeBuildRoleEast1"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

Write-Host "Account=$Account Region=$Region Root=$Root"
$env:AWS_DEFAULT_REGION = $Region

function Get-EnvVal([string]$key, [string]$fallback = "") {
  $line = Get-Content (Join-Path $Root ".env.local") -ErrorAction SilentlyContinue |
    Where-Object { $_ -match "^$([regex]::Escape($key))=" } | Select-Object -First 1
  if (-not $line) { return $fallback }
  return $line.Substring($key.Length + 1).Trim()
}

# ---------- DynamoDB ----------
cmd /c "`"$aws`" dynamodb describe-table --table-name BediApp --region $Region >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws dynamodb create-table --region $Region --table-name BediApp --billing-mode PAY_PER_REQUEST `
    --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S `
    --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE | Out-Null
  & $aws dynamodb wait table-exists --table-name BediApp --region $Region
  Write-Host "Created DynamoDB BediApp in $Region"
} else { Write-Host "DynamoDB BediApp exists" }

# ---------- ECR ----------
cmd /c "`"$aws`" ecr describe-repositories --repository-names $Repo --region $Region >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws ecr create-repository --repository-name $Repo --region $Region | Out-Null
  Write-Host "Created ECR $Repo"
}

# ---------- S3 for CodeBuild source ----------
cmd /c "`"$aws`" s3api head-bucket --bucket $Bucket >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws s3api create-bucket --bucket $Bucket --region $Region | Out-Null
  Write-Host "Created S3 $Bucket"
}

# ---------- IAM: CodeBuild ----------
$cbTrust = Join-Path $env:TEMP "bedi-cb-east-trust.json"
$cbPolicy = Join-Path $env:TEMP "bedi-cb-east-policy.json"
@'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]}
'@ | Set-Content $cbTrust -Encoding ascii
@"
{"Version":"2012-10-17","Statement":[
{"Effect":"Allow","Action":["logs:*"],"Resource":"*"},
{"Effect":"Allow","Action":["s3:GetObject","s3:GetObjectVersion"],"Resource":"arn:aws:s3:::${Bucket}/*"},
{"Effect":"Allow","Action":["ecr:GetAuthorizationToken"],"Resource":"*"},
{"Effect":"Allow","Action":["ecr:BatchCheckLayerAvailability","ecr:CompleteLayerUpload","ecr:InitiateLayerUpload","ecr:PutImage","ecr:UploadLayerPart","ecr:BatchGetImage","ecr:GetDownloadUrlForLayer"],"Resource":"arn:aws:ecr:${Region}:${Account}:repository/${Repo}"}
]}
"@ | Set-Content $cbPolicy -Encoding ascii
cmd /c "`"$aws`" iam get-role --role-name $BuildRole >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws iam create-role --role-name $BuildRole --assume-role-policy-document "file://$cbTrust" | Out-Null
  Start-Sleep -Seconds 8
}
& $aws iam put-role-policy --role-name $BuildRole --policy-name BediCodeBuildAccess --policy-document "file://$cbPolicy" | Out-Null
$BuildRoleArn = (& $aws iam get-role --role-name $BuildRole --query Role.Arn --output text).Trim()

# ---------- IAM: ECS execution + task ----------
$ecsTrust = Join-Path $env:TEMP "bedi-ecs-trust.json"
@'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}
'@ | Set-Content $ecsTrust -Encoding ascii

cmd /c "`"$aws`" iam get-role --role-name $ExecRole >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws iam create-role --role-name $ExecRole --assume-role-policy-document "file://$ecsTrust" | Out-Null
  & $aws iam attach-role-policy --role-name $ExecRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy | Out-Null
  Start-Sleep -Seconds 5
}
$ExecRoleArn = (& $aws iam get-role --role-name $ExecRole --query Role.Arn --output text).Trim()

$taskPolicy = Join-Path $env:TEMP "bedi-ecs-task-policy.json"
@"
{"Version":"2012-10-17","Statement":[
{"Effect":"Allow","Action":["dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:DeleteItem","dynamodb:Query","dynamodb:Scan","dynamodb:DescribeTable","dynamodb:TransactWriteItems","dynamodb:TransactGetItems","dynamodb:ConditionCheckItem"],"Resource":"arn:aws:dynamodb:${Region}:${Account}:table/BediApp"},
{"Effect":"Allow","Action":["bedrock:InvokeModel","bedrock:InvokeModelWithResponseStream","bedrock:Converse","bedrock:ConverseStream","bedrock:ApplyGuardrail"],"Resource":"*"},
{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":[
  "arn:aws:s3:::${Bucket}/avatars/*",
  "arn:aws:s3:::${Bucket}/schedule-images/*",
  "arn:aws:s3:::${Bucket}/photos/*"
]},
{"Effect":"Allow","Action":["cloudwatch:PutMetricData"],"Resource":"*","Condition":{"StringEquals":{"cloudwatch:namespace":"Beddy"}}}
]}
"@ | Set-Content $taskPolicy -Encoding ascii
cmd /c "`"$aws`" iam get-role --role-name $TaskRole >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws iam create-role --role-name $TaskRole --assume-role-policy-document "file://$ecsTrust" | Out-Null
  Start-Sleep -Seconds 5
}
& $aws iam put-role-policy --role-name $TaskRole --policy-name BediEcsTaskAccess --policy-document "file://$taskPolicy" | Out-Null
$TaskRoleArn = (& $aws iam get-role --role-name $TaskRole --query Role.Arn --output text).Trim()

# ---------- CodeBuild project ----------
$projJson = @{
  name = $Project
  source = @{ type = "S3"; location = "$Bucket/src/bedi-source.zip" }
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
$projPath = Join-Path $env:TEMP "bedi-cb-east-project.json"
[System.IO.File]::WriteAllText($projPath, ($projJson | ConvertTo-Json -Depth 8 -Compress))

$existingProj = & $aws codebuild batch-get-projects --names $Project --region $Region --query "projects[0].name" --output text 2>$null
if ($existingProj -and $existingProj -ne "None") {
  & $aws codebuild update-project --cli-input-json "file://$projPath" --region $Region | Out-Null
} else {
  & $aws codebuild create-project --cli-input-json "file://$projPath" --region $Region | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "create-project failed" }
}
Write-Host "CodeBuild project ready: $Project"

# ---------- Zip + upload ----------
$Zip = Join-Path $env:TEMP "bedi-source-east.zip"
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Push-Location $Root
& tar -a -c -f $Zip --exclude=node_modules --exclude=.next --exclude=.data --exclude=.git --exclude=.cursor .
Pop-Location
& tar -tf $Zip | Select-String -Pattern "^(\./)?src/app/" | Select-Object -First 1 | ForEach-Object { Write-Host "zip ok: $_" }
& $aws s3 cp $Zip "s3://$Bucket/src/bedi-source.zip" --region $Region | Out-Null

$BuildId = (& $aws codebuild start-build --project-name $Project --region $Region --query build.id --output text).Trim()
Write-Host "Build: $BuildId"
do {
  Start-Sleep -Seconds 25
  $status = (& $aws codebuild batch-get-builds --ids $BuildId --region $Region --query "builds[0].buildStatus" --output text).Trim()
  Write-Host "  buildStatus=$status"
} while ($status -eq "IN_PROGRESS" -or $status -eq "PENDING")
if ($status -ne "SUCCEEDED") { throw "CodeBuild $status" }

$Image = "$Account.dkr.ecr.$Region.amazonaws.com/${Repo}:latest"

# ---------- Networking (default VPC) ----------
$VpcId = (& $aws ec2 describe-vpcs --region $Region --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text).Trim()
# Prefer tagged public subnets; fallback to any subnet in VPC
$Subnets = @(& $aws ec2 describe-subnets --region $Region --filters "Name=vpc-id,Values=$VpcId" "Name=tag:Name,Values=bedi-public-*" --query "Subnets[].SubnetId" --output text)
$Subnets = ($Subnets -join ' ').Trim() -split '\s+' | Where-Object { $_ }
if ($Subnets.Count -lt 2) {
  $Subnets = @(& $aws ec2 describe-subnets --region $Region --filters "Name=vpc-id,Values=$VpcId" --query "Subnets[].SubnetId" --output text)
  $Subnets = ($Subnets -join ' ').Trim() -split '\s+' | Where-Object { $_ }
}
if ($Subnets.Count -lt 2) { throw "Need at least 2 subnets in default VPC (got $($Subnets.Count)). Run subnet bootstrap first." }
$Subnet1 = $Subnets[0]; $Subnet2 = $Subnets[1]
Write-Host "VPC=$VpcId subnets=$Subnet1,$Subnet2"

# Public egress for Fargate (ECR pull): replace blackhole NAT default route with IGW
$IgwId = (& $aws ec2 describe-internet-gateways --region $Region --filters "Name=attachment.vpc-id,Values=$VpcId" --query "InternetGateways[0].InternetGatewayId" --output text).Trim()
if ($IgwId -and $IgwId -ne "None") {
  $RtbId = (& $aws ec2 describe-route-tables --region $Region --filters "Name=association.subnet-id,Values=$Subnet1" --query "RouteTables[0].RouteTableId" --output text).Trim()
  if (-not $RtbId -or $RtbId -eq "None") {
    $RtbId = (& $aws ec2 describe-route-tables --region $Region --filters "Name=vpc-id,Values=$VpcId" "Name=association.main,Values=true" --query "RouteTables[0].RouteTableId" --output text).Trim()
  }
  $DefRoute = & $aws ec2 describe-route-tables --region $Region --route-table-ids $RtbId --query "RouteTables[0].Routes[?DestinationCidrBlock=='0.0.0.0/0'] | [0]" --output json 2>$null | ConvertFrom-Json
  if ($DefRoute -and ($DefRoute.State -eq "blackhole" -or $DefRoute.NatGatewayId)) {
    cmd /c "`"$aws`" ec2 delete-route --region $Region --route-table-id $RtbId --destination-cidr-block 0.0.0.0/0 >nul 2>&1"
    & $aws ec2 create-route --region $Region --route-table-id $RtbId --destination-cidr-block 0.0.0.0/0 --gateway-id $IgwId | Out-Null
    Write-Host "Fixed default route -> IGW $IgwId"
  } elseif (-not $DefRoute) {
    & $aws ec2 create-route --region $Region --route-table-id $RtbId --destination-cidr-block 0.0.0.0/0 --gateway-id $IgwId 2>$null | Out-Null
  }
}

# Security groups
function Ensure-Sg([string]$Name, [string]$Desc) {
  $id = & $aws ec2 describe-security-groups --region $Region --filters Name=vpc-id,Values=$VpcId Name=group-name,Values=$Name --query "SecurityGroups[0].GroupId" --output text 2>$null
  if ($id -and $id -ne "None") { return $id.Trim() }
  return (& $aws ec2 create-security-group --region $Region --group-name $Name --description $Desc --vpc-id $VpcId --query GroupId --output text).Trim()
}
$AlbSg = Ensure-Sg "bedi-alb-sg" "Bedi ALB"
$EcsSg = Ensure-Sg "bedi-ecs-sg" "Bedi ECS tasks"
# ALB ingress 80
cmd /c "`"$aws`" ec2 authorize-security-group-ingress --region $Region --group-id $AlbSg --protocol tcp --port 80 --cidr 0.0.0.0/0 >nul 2>&1"
# ECS from ALB on 3000
cmd /c "`"$aws`" ec2 authorize-security-group-ingress --region $Region --group-id $EcsSg --protocol tcp --port 3000 --source-group $AlbSg >nul 2>&1"

# ---------- CloudWatch log group ----------
cmd /c "`"$aws`" logs describe-log-groups --region $Region --log-group-name-prefix $LogGroup --query logGroups[0].logGroupName --output text 2>nul" | Out-Null
$lg = & $aws logs describe-log-groups --region $Region --log-group-name-prefix $LogGroup --query "logGroups[?logGroupName=='$LogGroup'].logGroupName | [0]" --output text 2>$null
if (-not $lg -or $lg -eq "None") {
  & $aws logs create-log-group --region $Region --log-group-name $LogGroup | Out-Null
}

# ---------- ALB + TG + Listener ----------
$AlbArn = & $aws elbv2 describe-load-balancers --region $Region --names bedi-alb --query "LoadBalancers[0].LoadBalancerArn" --output text 2>$null
if (-not $AlbArn -or $AlbArn -eq "None") {
  $AlbArn = (& $aws elbv2 create-load-balancer --region $Region --name bedi-alb --type application --scheme internet-facing `
    --subnets $Subnet1 $Subnet2 --security-groups $AlbSg --query "LoadBalancers[0].LoadBalancerArn" --output text).Trim()
  Write-Host "Created ALB"
} else { $AlbArn = $AlbArn.Trim() }

$TgArn = & $aws elbv2 describe-target-groups --region $Region --names bedi-tg --query "TargetGroups[0].TargetGroupArn" --output text 2>$null
if (-not $TgArn -or $TgArn -eq "None") {
  $TgArn = (& $aws elbv2 create-target-group --region $Region --name bedi-tg --protocol HTTP --port 3000 --vpc-id $VpcId `
    --target-type ip --health-check-path /login --health-check-interval-seconds 30 --healthy-threshold-count 2 `
    --query "TargetGroups[0].TargetGroupArn" --output text).Trim()
  Write-Host "Created target group"
} else { $TgArn = $TgArn.Trim() }

$Listener = & $aws elbv2 describe-listeners --region $Region --load-balancer-arn $AlbArn --query "Listeners[0].ListenerArn" --output text 2>$null
if (-not $Listener -or $Listener -eq "None") {
  & $aws elbv2 create-listener --region $Region --load-balancer-arn $AlbArn --protocol HTTP --port 80 `
    --default-actions "Type=forward,TargetGroupArn=$TgArn" | Out-Null
}

$AlbDns = (& $aws elbv2 describe-load-balancers --region $Region --load-balancer-arns $AlbArn --query "LoadBalancers[0].DNSName" --output text).Trim()
& $aws elbv2 modify-load-balancer-attributes --region $Region --load-balancer-arn $AlbArn `
  --attributes Key=idle_timeout.timeout_seconds,Value=180 | Out-Null
Write-Host "ALB idle timeout=180s"

# ---------- ECS cluster ----------
cmd /c "`"$aws`" ecs describe-clusters --region $Region --clusters $Cluster --query clusters[0].status --output text 2>nul" | Out-Null
$cl = & $aws ecs describe-clusters --region $Region --clusters $Cluster --query "clusters[0].status" --output text 2>$null
if (-not $cl -or $cl -eq "None" -or $cl -eq "INACTIVE") {
  & $aws ecs create-cluster --region $Region --cluster-name $Cluster | Out-Null
  Write-Host "Created cluster $Cluster"
}

# ---------- Task definition ----------
# Refresh Secrets Manager values from .env.local (STEP 5-3)
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "08-secrets.ps1") | Write-Host
$SecretArn = (Get-Content (Join-Path $PSScriptRoot "last-secret-arn.txt") -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $SecretArn) {
  throw "Missing scripts/aws/last-secret-arn.txt — run 08-secrets.ps1 first"
}
$pgHost = Get-EnvVal "PGHOST" ""
$cfUrl = Get-EnvVal "NEXT_PUBLIC_APP_URL" ""
$appUrl = if ($cfUrl -and $cfUrl -notmatch "localhost") { $cfUrl } else { "https://d36nmab92hbhe2.cloudfront.net" }
$envList = @(
  @{ name = "PERSISTENCE"; value = "dynamodb" },
  @{ name = "BEDI_DDB_TABLE"; value = "BediApp" },
  @{ name = "AWS_REGION"; value = $Region },
  @{ name = "LLM_PROVIDER"; value = (Get-EnvVal "LLM_PROVIDER" "bedrock") },
  @{ name = "LLM_FALLBACK_TO_MOCK"; value = (Get-EnvVal "LLM_FALLBACK_TO_MOCK" "true") },
  @{ name = "BEDROCK_MODEL_ID"; value = (Get-EnvVal "BEDROCK_MODEL_ID" "us.anthropic.claude-haiku-4-5-20251001-v1:0") },
  @{ name = "BEDROCK_MODEL_ID_CHAT"; value = (Get-EnvVal "BEDROCK_MODEL_ID_CHAT" "us.anthropic.claude-haiku-4-5-20251001-v1:0") },
  @{ name = "BEDROCK_MODEL_ID_QUALITY"; value = (Get-EnvVal "BEDROCK_MODEL_ID_QUALITY" (Get-EnvVal "BEDROCK_MODEL_ID" "us.anthropic.claude-opus-4-6-v1")) },
  @{ name = "BEDROCK_GUARDRAIL_ID"; value = (Get-EnvVal "BEDROCK_GUARDRAIL_ID" "") },
  @{ name = "BEDROCK_GUARDRAIL_VERSION"; value = (Get-EnvVal "BEDROCK_GUARDRAIL_VERSION" "1") },
  @{ name = "BEDROCK_IMAGE_MODEL_ID"; value = (Get-EnvVal "BEDROCK_IMAGE_MODEL_ID" "stability.stable-image-core-v1:1") },
  @{ name = "BEDROCK_IMAGE_REGION"; value = (Get-EnvVal "BEDROCK_IMAGE_REGION" "us-west-2") },
  @{ name = "BEDROCK_IMAGE_REMOVE_BG_MODEL_ID"; value = (Get-EnvVal "BEDROCK_IMAGE_REMOVE_BG_MODEL_ID" "us.stability.stable-image-remove-background-v1:0") },
  @{ name = "AVATAR_REMOVE_BG"; value = (Get-EnvVal "AVATAR_REMOVE_BG" "false") },
  @{ name = "AVATAR_S3_BUCKET"; value = $Bucket },
  @{ name = "AVATAR_S3_REGION"; value = $Region },
  @{ name = "AUTH_PROVIDER"; value = (Get-EnvVal "AUTH_PROVIDER" "dynamodb") },
  @{ name = "OPENAI_MODEL"; value = (Get-EnvVal "OPENAI_MODEL" "gpt-4o-mini") },
  @{ name = "OPENAI_BASE_URL"; value = (Get-EnvVal "OPENAI_BASE_URL" "https://api.openai.com/v1") },
  @{ name = "NEXT_PUBLIC_APP_URL"; value = $appUrl },
  @{ name = "PGHOST"; value = $pgHost },
  @{ name = "PGPORT"; value = (Get-EnvVal "PGPORT" "5432") },
  @{ name = "PGDATABASE"; value = (Get-EnvVal "PGDATABASE" "bedi") },
  @{ name = "PGUSER"; value = (Get-EnvVal "PGUSER" "bediadmin") },
  @{ name = "PGSSL"; value = "true" },
  @{ name = "PORT"; value = "3000" },
  @{ name = "HOSTNAME"; value = "0.0.0.0" }
)

$secretList = @(
  @{ name = "AUTH_SESSION_SECRET"; valueFrom = "${SecretArn}:AUTH_SESSION_SECRET::" },
  @{ name = "OPENAI_API_KEY"; valueFrom = "${SecretArn}:OPENAI_API_KEY::" },
  @{ name = "PGPASSWORD"; valueFrom = "${SecretArn}:PGPASSWORD::" },
  @{ name = "CRON_SECRET"; valueFrom = "${SecretArn}:CRON_SECRET::" }
)

$td = @{
  family = $TaskFamily
  networkMode = "awsvpc"
  requiresCompatibilities = @("FARGATE")
  cpu = "1024"
  memory = "2048"
  executionRoleArn = $ExecRoleArn
  taskRoleArn = $TaskRoleArn
  containerDefinitions = @(
    @{
      name = "bedi"
      image = $Image
      essential = $true
      portMappings = @(@{ containerPort = 3000; protocol = "tcp" })
      environment = $envList
      secrets = $secretList
      logConfiguration = @{
        logDriver = "awslogs"
        options = @{
          "awslogs-group" = $LogGroup
          "awslogs-region" = $Region
          "awslogs-stream-prefix" = "bedi"
        }
      }
    }
  )
}
$tdPath = Join-Path $env:TEMP "bedi-taskdef.json"
$tdIn = Join-Path $env:TEMP "bedi-taskdef-in.json"
[System.IO.File]::WriteAllText($tdIn, ($td | ConvertTo-Json -Depth 12))
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8').replace(/^\uFEFF/,''));fs.writeFileSync(process.argv[2],JSON.stringify(j));" $tdIn $tdPath
$TdArn = (& $aws ecs register-task-definition --cli-input-json "file://$tdPath" --region $Region --query "taskDefinition.taskDefinitionArn" --output text).Trim()
Write-Host "TaskDef=$TdArn"

# ---------- ECS service ----------
$svcStatus = & $aws ecs describe-services --region $Region --cluster $Cluster --services $Service --query "services[0].status" --output text 2>$null
if ($svcStatus -and $svcStatus -ne "None" -and $svcStatus -ne "INACTIVE") {
  & $aws ecs update-service --region $Region --cluster $Cluster --service $Service --task-definition $TdArn --force-new-deployment | Out-Null
  Write-Host "Updated ECS service"
} else {
  & $aws ecs create-service --region $Region --cluster $Cluster --service-name $Service --task-definition $TdArn `
    --desired-count 1 --launch-type FARGATE `
    --network-configuration "awsvpcConfiguration={subnets=[$Subnet1,$Subnet2],securityGroups=[$EcsSg],assignPublicIp=ENABLED}" `
    --load-balancers "targetGroupArn=$TgArn,containerName=bedi,containerPort=3000" `
    --health-check-grace-period-seconds 120 | Out-Null
  Write-Host "Created ECS service"
}

Write-Host "Waiting for service stable..."
& $aws ecs wait services-stable --region $Region --cluster $Cluster --services $Service
$AlbDns = (& $aws elbv2 describe-load-balancers --region $Region --load-balancer-arns $AlbArn --query "LoadBalancers[0].DNSName" --output text).Trim()
Write-Host "Deployed: http://$AlbDns"
Set-Content (Join-Path $Root "scripts\aws\last-deploy-url.txt") "http://$AlbDns" -Encoding ascii

try {
  $r = Invoke-WebRequest -Uri "http://$AlbDns/login" -UseBasicParsing -TimeoutSec 40
  Write-Host "GET /login -> $($r.StatusCode)"
} catch {
  Write-Host "Smoke warning: $($_.Exception.Message)"
}
