# Continue ECS deploy in us-east-1 assuming ECR image :latest already exists
$ErrorActionPreference = "Stop"
$aws = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
$Region = "us-east-1"
$Account = (& $aws sts get-caller-identity --query Account --output text).Trim()
$Repo = "bedi-app"
$Cluster = "bedi-cluster"
$Service = "bedi-service"
$TaskFamily = "bedi-app"
$LogGroup = "/ecs/bedi-app"
$ExecRole = "BediEcsTaskExecutionRole"
$TaskRole = "BediEcsTaskRole"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Image = "$Account.dkr.ecr.$Region.amazonaws.com/${Repo}:latest"
$env:AWS_DEFAULT_REGION = $Region

function Get-EnvVal([string]$key, [string]$fallback = "") {
  $line = Get-Content (Join-Path $Root ".env.local") -ErrorAction SilentlyContinue |
    Where-Object { $_ -match "^$([regex]::Escape($key))=" } | Select-Object -First 1
  if (-not $line) { return $fallback }
  return $line.Substring($key.Length + 1).Trim()
}

$VpcId = (& $aws ec2 describe-vpcs --region $Region --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text).Trim()
$Subnets = @(& $aws ec2 describe-subnets --region $Region --filters "Name=vpc-id,Values=$VpcId" --query "Subnets[].SubnetId" --output text)
$Subnets = ($Subnets -join ' ').Trim() -split '\s+' | Where-Object { $_ }
if ($Subnets.Count -lt 2) { throw "Need 2 subnets, got $($Subnets.Count)" }
$Subnet1 = $Subnets[0]; $Subnet2 = $Subnets[1]
Write-Host "VPC=$VpcId $Subnet1 $Subnet2"

function Ensure-Sg([string]$Name, [string]$Desc) {
  $id = & $aws ec2 describe-security-groups --region $Region --filters Name=vpc-id,Values=$VpcId Name=group-name,Values=$Name --query "SecurityGroups[0].GroupId" --output text 2>$null
  if ($id -and $id -ne "None") { return $id.Trim() }
  return (& $aws ec2 create-security-group --region $Region --group-name $Name --description $Desc --vpc-id $VpcId --query GroupId --output text).Trim()
}
$AlbSg = Ensure-Sg "bedi-alb-sg" "Bedi ALB"
$EcsSg = Ensure-Sg "bedi-ecs-sg" "Bedi ECS tasks"
& $aws ec2 authorize-security-group-ingress --region $Region --group-id $AlbSg --protocol tcp --port 80 --cidr 0.0.0.0/0 2>$null | Out-Null
& $aws ec2 authorize-security-group-ingress --region $Region --group-id $EcsSg --protocol tcp --port 3000 --source-group $AlbSg 2>$null | Out-Null

$lg = & $aws logs describe-log-groups --region $Region --log-group-name-prefix $LogGroup --query "logGroups[?logGroupName=='$LogGroup'].logGroupName | [0]" --output text 2>$null
if (-not $lg -or $lg -eq "None") {
  & $aws logs create-log-group --region $Region --log-group-name $LogGroup | Out-Null
}

$AlbArn = & $aws elbv2 describe-load-balancers --region $Region --names bedi-alb --query "LoadBalancers[0].LoadBalancerArn" --output text 2>$null
if (-not $AlbArn -or $AlbArn -eq "None") {
  $AlbArn = (& $aws elbv2 create-load-balancer --region $Region --name bedi-alb --type application --scheme internet-facing `
    --subnets $Subnet1 $Subnet2 --security-groups $AlbSg --query "LoadBalancers[0].LoadBalancerArn" --output text).Trim()
} else { $AlbArn = $AlbArn.Trim() }

$TgArn = & $aws elbv2 describe-target-groups --region $Region --names bedi-tg --query "TargetGroups[0].TargetGroupArn" --output text 2>$null
if (-not $TgArn -or $TgArn -eq "None") {
  $TgArn = (& $aws elbv2 create-target-group --region $Region --name bedi-tg --protocol HTTP --port 3000 --vpc-id $VpcId `
    --target-type ip --health-check-path /login --health-check-interval-seconds 30 --healthy-threshold-count 2 `
    --matcher HttpCode=200-399 --query "TargetGroups[0].TargetGroupArn" --output text).Trim()
} else { $TgArn = $TgArn.Trim() }

$Listener = & $aws elbv2 describe-listeners --region $Region --load-balancer-arn $AlbArn --query "Listeners[0].ListenerArn" --output text 2>$null
if (-not $Listener -or $Listener -eq "None") {
  & $aws elbv2 create-listener --region $Region --load-balancer-arn $AlbArn --protocol HTTP --port 80 `
    --default-actions "Type=forward,TargetGroupArn=$TgArn" | Out-Null
}

$AlbDns = (& $aws elbv2 describe-load-balancers --region $Region --load-balancer-arns $AlbArn --query "LoadBalancers[0].DNSName" --output text).Trim()
Write-Host "ALB=$AlbDns"

$cl = & $aws ecs describe-clusters --region $Region --clusters $Cluster --query "clusters[0].status" --output text 2>$null
if (-not $cl -or $cl -eq "None" -or $cl -eq "INACTIVE") {
  & $aws ecs create-cluster --region $Region --cluster-name $Cluster | Out-Null
}

$ExecRoleArn = (& $aws iam get-role --role-name $ExecRole --query Role.Arn --output text).Trim()
$TaskRoleArn = (& $aws iam get-role --role-name $TaskRole --query Role.Arn --output text).Trim()

$oak = Get-EnvVal "OPENAI_API_KEY" ""
$envList = @(
  @{ name = "PERSISTENCE"; value = "dynamodb" },
  @{ name = "BEDI_DDB_TABLE"; value = "BediApp" },
  @{ name = "AWS_REGION"; value = $Region },
  @{ name = "LLM_PROVIDER"; value = (Get-EnvVal "LLM_PROVIDER" "openai") },
  @{ name = "LLM_FALLBACK_TO_MOCK"; value = "true" },
  @{ name = "BEDROCK_MODEL_ID"; value = (Get-EnvVal "BEDROCK_MODEL_ID" "us.anthropic.claude-haiku-4-5-20251001-v1:0") },
  @{ name = "AUTH_SESSION_SECRET"; value = (Get-EnvVal "AUTH_SESSION_SECRET" "bedi-prod-change-me") },
  @{ name = "OPENAI_MODEL"; value = (Get-EnvVal "OPENAI_MODEL" "gpt-4o-mini") },
  @{ name = "OPENAI_BASE_URL"; value = (Get-EnvVal "OPENAI_BASE_URL" "https://api.openai.com/v1") },
  @{ name = "NEXT_PUBLIC_APP_URL"; value = "http://$AlbDns" },
  @{ name = "PORT"; value = "3000" },
  @{ name = "HOSTNAME"; value = "0.0.0.0" }
)
if ($oak) { $envList += @{ name = "OPENAI_API_KEY"; value = $oak } }

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
$tdIn = Join-Path $env:TEMP "bedi-td-in.json"
$tdPath = Join-Path $env:TEMP "bedi-td.json"
[System.IO.File]::WriteAllText($tdIn, ($td | ConvertTo-Json -Depth 12))
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8').replace(/^\uFEFF/,''));fs.writeFileSync(process.argv[2],JSON.stringify(j));" $tdIn $tdPath
$TdArn = (& $aws ecs register-task-definition --cli-input-json "file://$tdPath" --region $Region --query "taskDefinition.taskDefinitionArn" --output text).Trim()
Write-Host "TaskDef=$TdArn"

$svcStatus = & $aws ecs describe-services --region $Region --cluster $Cluster --services $Service --query "services[0].status" --output text 2>$null
if ($svcStatus -and $svcStatus -ne "None" -and $svcStatus -ne "INACTIVE") {
  & $aws ecs update-service --region $Region --cluster $Cluster --service $Service --task-definition $TdArn --force-new-deployment | Out-Null
} else {
  & $aws ecs create-service --region $Region --cluster $Cluster --service-name $Service --task-definition $TdArn `
    --desired-count 1 --launch-type FARGATE `
    --network-configuration "awsvpcConfiguration={subnets=[$Subnet1,$Subnet2],securityGroups=[$EcsSg],assignPublicIp=ENABLED}" `
    --load-balancers "targetGroupArn=$TgArn,containerName=bedi,containerPort=3000" `
    --health-check-grace-period-seconds 180 | Out-Null
}

Write-Host "Waiting for service stable (can take several minutes)..."
& $aws ecs wait services-stable --region $Region --cluster $Cluster --services $Service
$AlbDns = (& $aws elbv2 describe-load-balancers --region $Region --load-balancer-arns $AlbArn --query "LoadBalancers[0].DNSName" --output text).Trim()
Write-Host "Deployed: http://$AlbDns"
Set-Content (Join-Path $Root "scripts\aws\last-deploy-url.txt") "http://$AlbDns" -Encoding ascii
try {
  $r = Invoke-WebRequest -Uri "http://$AlbDns/login" -UseBasicParsing -TimeoutSec 40
  Write-Host "GET /login -> $($r.StatusCode)"
} catch {
  Write-Host "Smoke: $($_.Exception.Message)"
  # show recent logs
  & $aws logs tail $LogGroup --region $Region --since 10m 2>&1 | Select-Object -Last 40
}
