# STEP 6: Bedrock Knowledge Base + S3 Vectors (summaries only)
# Data source: s3://bedi-codebuild-ACCOUNT-REGION/kb-summaries/
$ErrorActionPreference = "Stop"
$aws = if (Get-Command aws -ErrorAction SilentlyContinue) { "aws" } else { "C:\Program Files\Amazon\AWSCLIV2\aws.exe" }

$Region = "us-east-1"
$Account = (& $aws sts get-caller-identity --query Account --output text).Trim()
$DataBucket = "bedi-codebuild-$Account-$Region"
$VectorBucket = "bedi-kb-vectors-$Account"
$IndexName = "bedi-summaries"
$KbName = "bedi-child-summaries"
$DsName = "bedi-kb-summaries-s3"
$RoleName = "BediBedrockKbRole"
$EmbedArn = "arn:aws:bedrock:${Region}::foundation-model/amazon.titan-embed-text-v2:0"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$env:AWS_DEFAULT_REGION = $Region

Write-Host "Account=$Account Region=$Region"
Write-Host "DataBucket=$DataBucket VectorBucket=$VectorBucket"

# Seed empty prefix so data source exists
$seedKey = "kb-summaries/_keep/README.md"
$seedFile = Join-Path $env:TEMP "bedi-kb-seed.md"
@"
# Beddy KB summaries
Privacy-safe child summaries only. No raw chat transcripts.
"@ | Set-Content $seedFile -Encoding utf8
& $aws s3 cp $seedFile "s3://$DataBucket/$seedKey" --region $Region | Out-Null

# --- S3 Vectors bucket + index ---
cmd /c "`"$aws`" s3vectors get-vector-bucket --vector-bucket-name $VectorBucket --region $Region >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws s3vectors create-vector-bucket --vector-bucket-name $VectorBucket --region $Region | Out-Null
  Write-Host "Created vector bucket $VectorBucket"
} else {
  Write-Host "Vector bucket exists"
}

$VectorBucketArn = (& $aws s3vectors get-vector-bucket --vector-bucket-name $VectorBucket --region $Region --query vectorBucket.vectorBucketArn --output text).Trim()

cmd /c "`"$aws`" s3vectors get-index --vector-bucket-name $VectorBucket --index-name $IndexName --region $Region >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws s3vectors create-index `
    --vector-bucket-name $VectorBucket `
    --index-name $IndexName `
    --data-type float32 `
    --dimension 1024 `
    --distance-metric cosine `
    --region $Region | Out-Null
  Write-Host "Created vector index $IndexName"
  Start-Sleep -Seconds 5
} else {
  Write-Host "Vector index exists"
}

$IndexArn = (& $aws s3vectors get-index --vector-bucket-name $VectorBucket --index-name $IndexName --region $Region --query index.indexArn --output text).Trim()
Write-Host "IndexArn=$IndexArn"

# --- IAM role for Bedrock KB ---
$trust = Join-Path $env:TEMP "bedi-kb-trust.json"
@"
{"Version":"2012-10-17","Statement":[{
  "Effect":"Allow",
  "Principal":{"Service":"bedrock.amazonaws.com"},
  "Action":"sts:AssumeRole",
  "Condition":{"StringEquals":{"aws:SourceAccount":"$Account"},"ArnLike":{"aws:SourceArn":"arn:aws:bedrock:${Region}:${Account}:knowledge-base/*"}}
}]}
"@ | Set-Content $trust -Encoding ascii

cmd /c "`"$aws`" iam get-role --role-name $RoleName >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  & $aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$trust" | Out-Null
  Start-Sleep -Seconds 8
} else {
  & $aws iam update-assume-role-policy --role-name $RoleName --policy-document "file://$trust" | Out-Null
}

$kbPolicy = Join-Path $env:TEMP "bedi-kb-role-policy.json"
@"
{"Version":"2012-10-17","Statement":[
{"Sid":"S3List","Effect":"Allow","Action":["s3:ListBucket"],"Resource":"arn:aws:s3:::${DataBucket}","Condition":{"StringLike":{"s3:prefix":["kb-summaries","kb-summaries/*"]}}},
{"Sid":"S3Get","Effect":"Allow","Action":["s3:GetObject"],"Resource":"arn:aws:s3:::${DataBucket}/kb-summaries/*"},
{"Sid":"Embed","Effect":"Allow","Action":["bedrock:InvokeModel"],"Resource":["$EmbedArn"]},
{"Sid":"S3Vectors","Effect":"Allow","Action":[
  "s3vectors:QueryVectors","s3vectors:GetVectors","s3vectors:PutVectors","s3vectors:DeleteVectors",
  "s3vectors:GetIndex","s3vectors:ListIndexes","s3vectors:GetVectorBucket","s3vectors:ListVectorBuckets"
],"Resource":["$VectorBucketArn","$IndexArn","arn:aws:s3vectors:${Region}:${Account}:bucket/${VectorBucket}","arn:aws:s3vectors:${Region}:${Account}:bucket/${VectorBucket}/*"]}
]}
"@ | Set-Content $kbPolicy -Encoding ascii
& $aws iam put-role-policy --role-name $RoleName --policy-name BediKbAccess --policy-document "file://$kbPolicy" | Out-Null
$RoleArn = (& $aws iam get-role --role-name $RoleName --query Role.Arn --output text).Trim()
Write-Host "RoleArn=$RoleArn"
Start-Sleep -Seconds 10

# --- Knowledge Base ---
$existingKb = & $aws bedrock-agent list-knowledge-bases --region $Region --query "knowledgeBaseSummaries[?name=='$KbName'].knowledgeBaseId" --output text 2>$null
$KbId = ($existingKb | Out-String).Trim().Split([char[]]@("`t","`n","`r"," ")) | Where-Object { $_ } | Select-Object -First 1

if (-not $KbId) {
  $kbConfig = @{
    type = "VECTOR"
    vectorKnowledgeBaseConfiguration = @{
      embeddingModelArn = $EmbedArn
      embeddingModelConfiguration = @{
        bedrockEmbeddingModelConfiguration = @{
          dimensions = 1024
          embeddingDataType = "FLOAT32"
        }
      }
    }
  } | ConvertTo-Json -Depth 8 -Compress

  $storage = @{
    type = "S3_VECTORS"
    s3VectorsConfiguration = @{
      vectorBucketArn = $VectorBucketArn
      indexArn = $IndexArn
    }
  } | ConvertTo-Json -Depth 6 -Compress

  $kbConfigFile = Join-Path $env:TEMP "bedi-kb-config.json"
  $storageFile = Join-Path $env:TEMP "bedi-kb-storage.json"
  [System.IO.File]::WriteAllText($kbConfigFile, $kbConfig, [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText($storageFile, $storage, [System.Text.UTF8Encoding]::new($false))

  $KbId = (& $aws bedrock-agent create-knowledge-base `
    --name $KbName `
    --description "Beddy privacy-safe child summaries (no raw chat)" `
    --role-arn $RoleArn `
    --knowledge-base-configuration "file://$kbConfigFile" `
    --storage-configuration "file://$storageFile" `
    --region $Region `
    --query knowledgeBase.knowledgeBaseId --output text).Trim()
  Write-Host "Created KB $KbId"
  Start-Sleep -Seconds 8
} else {
  Write-Host "KB exists: $KbId"
}

# --- Data source ---
$existingDs = & $aws bedrock-agent list-data-sources --knowledge-base-id $KbId --region $Region --query "dataSourceSummaries[?name=='$DsName'].dataSourceId" --output text 2>$null
$DsId = ($existingDs | Out-String).Trim().Split([char[]]@("`t","`n","`r"," ")) | Where-Object { $_ } | Select-Object -First 1

if (-not $DsId) {
  $dsConfig = @{
    type = "S3"
    s3Configuration = @{
      bucketArn = "arn:aws:s3:::${DataBucket}"
      inclusionPrefixes = @("kb-summaries/")
    }
  } | ConvertTo-Json -Depth 6 -Compress
  $dsFile = Join-Path $env:TEMP "bedi-kb-ds.json"
  [System.IO.File]::WriteAllText($dsFile, $dsConfig, [System.Text.UTF8Encoding]::new($false))

  $DsId = (& $aws bedrock-agent create-data-source `
    --knowledge-base-id $KbId `
    --name $DsName `
    --data-source-configuration "file://$dsFile" `
    --region $Region `
    --query dataSource.dataSourceId --output text).Trim()
  Write-Host "Created data source $DsId"
} else {
  Write-Host "Data source exists: $DsId"
}

# Start ingestion (async)
try {
  $jobId = (& $aws bedrock-agent start-ingestion-job `
    --knowledge-base-id $KbId `
    --data-source-id $DsId `
    --region $Region `
    --query ingestionJob.ingestionJobId --output text).Trim()
  Write-Host "IngestionJob=$jobId"
} catch {
  Write-Host "Ingestion start skipped/failed (ok if empty): $_"
}

# ECS task role: Retrieve
$TaskRole = "BediEcsTaskRole"
$taskPolicy = Join-Path $env:TEMP "bedi-ecs-task-policy-kb.json"
@"
{"Version":"2012-10-17","Statement":[
{"Effect":"Allow","Action":["dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:DeleteItem","dynamodb:Query","dynamodb:Scan","dynamodb:DescribeTable","dynamodb:TransactWriteItems","dynamodb:TransactGetItems","dynamodb:ConditionCheckItem"],"Resource":"arn:aws:dynamodb:${Region}:${Account}:table/BediApp"},
{"Effect":"Allow","Action":["bedrock:InvokeModel","bedrock:InvokeModelWithResponseStream","bedrock:Converse","bedrock:ConverseStream","bedrock:ApplyGuardrail","bedrock:Retrieve","bedrock:RetrieveAndGenerate"],"Resource":"*"},
{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":[
  "arn:aws:s3:::${DataBucket}/avatars/*",
  "arn:aws:s3:::${DataBucket}/schedule-images/*",
  "arn:aws:s3:::${DataBucket}/photos/*",
  "arn:aws:s3:::${DataBucket}/kb-summaries/*"
]},
{"Effect":"Allow","Action":["s3:ListBucket"],"Resource":"arn:aws:s3:::${DataBucket}","Condition":{"StringLike":{"s3:prefix":["kb-summaries/*"]}}},
{"Effect":"Allow","Action":["cloudwatch:PutMetricData"],"Resource":"*","Condition":{"StringEquals":{"cloudwatch:namespace":"Beddy"}}}
]}
"@ | Set-Content $taskPolicy -Encoding ascii
cmd /c "`"$aws`" iam get-role --role-name $TaskRole >nul 2>&1"
if ($LASTEXITCODE -eq 0) {
  & $aws iam put-role-policy --role-name $TaskRole --policy-name BediEcsTaskAccess --policy-document "file://$taskPolicy" | Out-Null
  Write-Host "Updated ECS task role for Retrieve + kb-summaries"
}

Set-Content (Join-Path $PSScriptRoot "last-kb-id.txt") $KbId -Encoding ascii
Write-Host ""
Write-Host "BEDROCK_KB_ID=$KbId"
Write-Host "Add to .env.local and redeploy ECS:"
Write-Host "  BEDROCK_KB_ID=$KbId"
Write-Host "DONE"
