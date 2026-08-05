# Create / wait Aurora Serverless v2 (PostgreSQL) for Bedi auth
$ErrorActionPreference = "Stop"
$aws = if (Get-Command aws -ErrorAction SilentlyContinue) { "aws" } else { "C:\Program Files\Amazon\AWSCLIV2\aws.exe" }
$Region = "us-east-1"
$VpcId = "vpc-046e339ed44006b37"
$Subnet1 = "subnet-0f62ac2d4e1684a7a"
$Subnet2 = "subnet-04eaecbb7fb88bb59"
$EcsSg = "sg-05362d81f098217f7"
$ClusterId = "bedi-aurora"
$InstanceId = "bedi-aurora-instance"
$MasterUser = "bediadmin"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

$passFile = Join-Path $env:TEMP "bedi-aurora-pass.txt"
if (Test-Path $passFile) {
  $MasterPass = (Get-Content $passFile -Raw).Trim()
} else {
  $MasterPass = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
  Set-Content $passFile $MasterPass -Encoding ascii
}

cmd /c "`"$aws`" ec2 describe-security-groups --region $Region --filters Name=vpc-id,Values=$VpcId Name=group-name,Values=bedi-aurora-sg --query SecurityGroups[0].GroupId --output text > %TEMP%\bedi-aurora-sg.txt 2>nul"
$AuroraSg = (Get-Content "$env:TEMP\bedi-aurora-sg.txt" -EA SilentlyContinue | Select-Object -First 1)
if (-not $AuroraSg -or $AuroraSg -eq "None") {
  $AuroraSg = (& $aws ec2 create-security-group --region $Region --group-name bedi-aurora-sg --description "Bedi Aurora" --vpc-id $VpcId --query GroupId --output text).Trim()
} else { $AuroraSg = $AuroraSg.Trim() }
cmd /c "`"$aws`" ec2 authorize-security-group-ingress --region $Region --group-id $AuroraSg --protocol tcp --port 5432 --source-group $EcsSg >nul 2>&1"
cmd /c "`"$aws`" ec2 authorize-security-group-ingress --region $Region --group-id $AuroraSg --protocol tcp --port 5432 --cidr 0.0.0.0/0 >nul 2>&1"

cmd /c "`"$aws`" rds describe-db-subnet-groups --region $Region --db-subnet-group-name bedi-aurora-subnets >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws rds create-db-subnet-group --region $Region --db-subnet-group-name bedi-aurora-subnets --db-subnet-group-description "Bedi Aurora" --subnet-ids $Subnet1 $Subnet2 | Out-Null
}

cmd /c "`"$aws`" rds describe-db-clusters --region $Region --db-cluster-identifier $ClusterId >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws rds create-db-cluster --region $Region --db-cluster-identifier $ClusterId --engine aurora-postgresql --engine-version 15.10 `
    --master-username $MasterUser --master-user-password $MasterPass --db-subnet-group-name bedi-aurora-subnets `
    --vpc-security-group-ids $AuroraSg --database-name bedi `
    --serverless-v2-scaling-configuration "MinCapacity=0.5,MaxCapacity=2" --storage-encrypted --backup-retention-period 1 | Out-Null
}

cmd /c "`"$aws`" rds describe-db-instances --region $Region --db-instance-identifier $InstanceId >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws rds create-db-instance --region $Region --db-instance-identifier $InstanceId --db-cluster-identifier $ClusterId `
    --engine aurora-postgresql --db-instance-class db.serverless --publicly-accessible | Out-Null
}

Write-Host "Waiting for Aurora available..."
& $aws rds wait db-instance-available --region $Region --db-instance-identifier $InstanceId
$Endpoint = (& $aws rds describe-db-clusters --region $Region --db-cluster-identifier $ClusterId --query "DBClusters[0].Endpoint" --output text).Trim()
Write-Host "Endpoint=$Endpoint"

# Patch .env.local PGHOST/PGPASSWORD
$envPath = Join-Path $Root ".env.local"
$lines = @(Get-Content $envPath -ErrorAction SilentlyContinue)
$keys = @{ PGHOST = $Endpoint; PGPASSWORD = $MasterPass; PGUSER = $MasterUser; PGDATABASE = "bedi"; PGPORT = "5432"; PGSSL = "true"; AUTH_PROVIDER = "aurora"; LLM_PROVIDER = "bedrock" }
$seen = @{}
$out = foreach ($line in $lines) {
  if ($line -match '^([^=]+)=(.*)$' -and $keys.ContainsKey($Matches[1])) {
    $seen[$Matches[1]] = $true
    "$($Matches[1])=$($keys[$Matches[1]])"
  } else { $line }
}
foreach ($k in $keys.Keys) { if (-not $seen[$k]) { $out += "$k=$($keys[$k])" } }
Set-Content $envPath $out -Encoding utf8
Write-Host "Updated .env.local with PGHOST"

Push-Location $Root
$env:PGHOST = $Endpoint
$env:PGPASSWORD = $MasterPass
$env:PGUSER = $MasterUser
$env:PGDATABASE = "bedi"
$env:PGPORT = "5432"
$env:PGSSL = "true"
node scripts/seed-aurora-users.js
Pop-Location
Write-Host "Aurora ready + seeded"
