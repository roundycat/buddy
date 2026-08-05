# Shared AWS CLI resolver for Bedi scripts.
$ErrorActionPreference = "Stop"

if (-not (Get-Variable -Name Aws -Scope Script -ErrorAction SilentlyContinue)) {
  $script:Aws = if (Get-Command aws -ErrorAction SilentlyContinue) {
    "aws"
  } else {
    "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
  }
}
