import "server-only";
import {
  BedrockAgentClient,
  StartIngestionJobCommand,
} from "@aws-sdk/client-bedrock-agent";
import { env } from "@/backend/shared/config/env";
import { recordCount } from "@/backend/shared/observability";

/**
 * Re-index the guardian Knowledge Base after the dawn batch writes new
 * summaries to S3. (v1 wrote summaries but never started ingestion, so the
 * guardian Q&A kept answering from whatever was indexed at setup time.)
 */
export async function startKbIngestion(): Promise<{
  started: boolean;
  jobId?: string;
  reason?: string;
}> {
  const knowledgeBaseId = env.bedrock.knowledgeBaseId;
  const dataSourceId = env.bedrock.knowledgeBaseDataSourceId;
  if (!knowledgeBaseId || !dataSourceId) {
    return { started: false, reason: "not_configured" };
  }
  const { accessKeyId, secretAccessKey, sessionToken } = env.bedrock;
  const client = new BedrockAgentClient({
    region: env.bedrock.region,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } }
      : {}),
  });
  try {
    const out = await client.send(
      new StartIngestionJobCommand({ knowledgeBaseId, dataSourceId })
    );
    recordCount("KbIngestionStarted", 1, { feature: "kb", operation: "ingest" });
    return { started: true, jobId: out.ingestionJob?.ingestionJobId };
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    console.warn("[kb] ingestion not started:", reason);
    return { started: false, reason };
  }
}
