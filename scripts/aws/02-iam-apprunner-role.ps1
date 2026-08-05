# Create IAM role policies for App Runner instance (DynamoDB + Bedrock)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_aws.ps1"

$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-west-2" }
$Account = (& $Aws sts get-caller-identity --query Account --output text).Trim()
$RoleName = "BediAppRunnerInstanceRole"
$PolicyName = "BediAppRunnerAccess"

$Trust = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "tasks.apprunner.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
"@

$Policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoBediApp",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:DescribeTable"
      ],
      "Resource": "arn:aws:dynamodb:${Region}:${Account}:table/BediApp"
    },
    {
      "Sid": "BedrockConverse",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:Converse",
        "bedrock:ConverseStream"
      ],
      "Resource": "*"
    }
  ]
}
"@

$TrustPath = Join-Path $env:TEMP "bedi-apprunner-trust.json"
$PolicyPath = Join-Path $env:TEMP "bedi-apprunner-policy.json"
Set-Content -Path $TrustPath -Value $Trust -Encoding ascii
Set-Content -Path $PolicyPath -Value $Policy -Encoding ascii

Write-Host "Account=$Account Region=$Region"

& $Aws iam get-role --role-name $RoleName 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  & $Aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$TrustPath" | Out-Host
} else {
  Write-Host "Role exists: $RoleName"
}

& $Aws iam put-role-policy --role-name $RoleName --policy-name $PolicyName --policy-document "file://$PolicyPath"
Write-Host "Attached inline policy $PolicyName to $RoleName"
& $Aws iam get-role --role-name $RoleName --query "Role.Arn" --output text
