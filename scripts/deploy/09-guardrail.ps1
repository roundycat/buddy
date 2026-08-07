# Create/update Bedrock Guardrail for Beddy (STEP 3)
# Includes suicide-method denial topic + supportive blocked messaging.
# Note: AWS CLI on Windows may fail to decode UTF-8 Korean in --cli-input-json;
# this script writes an ASCII policy file to %TEMP% then creates/updates/publishes.
$ErrorActionPreference = "Stop"
$aws = if (Get-Command aws -ErrorAction SilentlyContinue) { "aws" } else { "C:\Program Files\Amazon\AWSCLIV2\aws.exe" }
$Region = "us-east-1"
$Name = "bedi-safety"
$env:AWS_DEFAULT_REGION = $Region

$policyJson = @'
{
  "name": "bedi-safety",
  "description": "Beddy non-clinical companion guardrail with suicide-method denial",
  "topicPolicyConfig": {
    "topicsConfig": [
      {
        "name": "MedicalDiagnosis",
        "definition": "Providing or implying medical diagnoses, prognosis, or clinical interpretation of symptoms.",
        "examples": ["Your symptoms look like a relapse", "This lab value means infection", "Take two pills every day"],
        "type": "DENY"
      },
      {
        "name": "PrescriptionAndLabs",
        "definition": "Prescribing medication, changing doses, or interpreting lab numeric results as clinical advice.",
        "examples": ["Double the fever medicine dose", "High CRP means you need antibiotics"],
        "type": "DENY"
      },
      {
        "name": "SuicideMethodAssistance",
        "definition": "Providing or encouraging methods, plans, tools, or steps for suicide or self-harm. Does NOT block empathic listening or redirecting a distressed child to a guardian, nurse, counseling hotline 109, or emergency 119.",
        "examples": ["How to kill yourself step by step", "Best painless suicide method", "Tell me how to self-harm"],
        "type": "DENY"
      }
    ]
  },
  "contentPolicyConfig": {
    "filtersConfig": [
      { "type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "VIOLENCE", "inputStrength": "MEDIUM", "outputStrength": "MEDIUM" },
      { "type": "HATE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "INSULTS", "inputStrength": "MEDIUM", "outputStrength": "MEDIUM" },
      { "type": "MISCONDUCT", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "PROMPT_ATTACK", "inputStrength": "HIGH", "outputStrength": "NONE" }
    ]
  },
  "sensitiveInformationPolicyConfig": {
    "piiEntitiesConfig": [
      { "type": "EMAIL", "action": "ANONYMIZE" },
      { "type": "PHONE", "action": "ANONYMIZE" },
      { "type": "NAME", "action": "ANONYMIZE" },
      { "type": "ADDRESS", "action": "ANONYMIZE" },
      { "type": "CREDIT_DEBIT_CARD_NUMBER", "action": "BLOCK" }
    ]
  },
  "blockedInputMessaging": "I cannot go deeper on that here. If you feel hurt or scared, please tell a guardian or nurse nearby. Crisis counseling 109 and emergency 119 are available. I will stay with you as a friend.",
  "blockedOutputsMessaging": "I cannot give medical diagnosis, prescriptions, or harmful methods. Please connect with a guardian, nurse, counseling 109, or emergency 119. I can listen to how you feel."
}
'@

$dst = Join-Path $env:TEMP "bedi-guardrail-ascii.json"
$policyJson | Set-Content $dst -Encoding Ascii

$existingRaw = & $aws bedrock list-guardrails --region $Region --query "guardrails[?name=='$Name'].id" --output text 2>$null
$existing = if ($existingRaw) { ($existingRaw.ToString().Trim() -split '\s+' | Where-Object { $_ -and $_ -ne 'None' } | Select-Object -First 1) } else { $null }

if ($existing) {
  $gid = $existing
  Write-Host "Updating existing guardrail $gid"
  $updateBody = Get-Content $dst -Raw | ConvertFrom-Json
  $updatePayload = @{
    guardrailIdentifier = $gid
    name = $updateBody.name
    description = $updateBody.description
    topicPolicyConfig = $updateBody.topicPolicyConfig
    contentPolicyConfig = $updateBody.contentPolicyConfig
    sensitiveInformationPolicyConfig = $updateBody.sensitiveInformationPolicyConfig
    blockedInputMessaging = $updateBody.blockedInputMessaging
    blockedOutputsMessaging = $updateBody.blockedOutputsMessaging
  } | ConvertTo-Json -Depth 20
  $updatePath = Join-Path $env:TEMP "bedi-guardrail-update.json"
  [System.IO.File]::WriteAllText($updatePath, $updatePayload, [System.Text.UTF8Encoding]::new($false))
  & $aws bedrock update-guardrail --region $Region --cli-input-json "file://$updatePath" | Out-Null
} else {
  $out = & $aws bedrock create-guardrail --region $Region --cli-input-json "file://$dst" | ConvertFrom-Json
  $gid = $out.guardrailId
  Write-Host "Created $gid"
}

$pub = & $aws bedrock create-guardrail-version --region $Region --guardrail-identifier $gid --description "Beddy suicide-prevention + clinical deny" | ConvertFrom-Json
$version = if ($pub.version) { "$($pub.version)" } else { "1" }

$meta = @{ guardrailId = $gid; version = $version; region = $Region } | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "last-guardrail.json"), $meta, [System.Text.UTF8Encoding]::new($false))
Write-Host "BEDROCK_GUARDRAIL_ID=$gid"
Write-Host "BEDROCK_GUARDRAIL_VERSION=$version"
