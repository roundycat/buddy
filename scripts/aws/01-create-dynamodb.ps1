# Create BediApp DynamoDB table (us-west-2) if missing
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\_aws.ps1"

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-west-2" }
$Table = if ($env:BEDI_DDB_TABLE) { $env:BEDI_DDB_TABLE } else { "BediApp" }

Write-Host "Using AWS CLI: $Aws"
Write-Host "Region=$Region Table=$Table"

& $Aws sts get-caller-identity --region $Region | Out-Host

& $Aws dynamodb describe-table --table-name $Table --region $Region 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Table already exists: $Table"
  exit 0
}

$ErrorActionPreference = "Stop"
& $Aws dynamodb create-table `
  --region $Region `
  --table-name $Table `
  --billing-mode PAY_PER_REQUEST `
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S `
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE `
  --tags Key=Project,Value=Bedi Key=Env,Value=mvp

& $Aws dynamodb wait table-exists --table-name $Table --region $Region
Write-Host "Created table $Table"
