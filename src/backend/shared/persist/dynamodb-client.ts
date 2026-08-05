import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { env } from "@/backend/shared/config/env";

let cached: DynamoDBDocumentClient | null = null;

/**
 * Shared DynamoDB Document client.
 * On App Runner, prefer instance role (no static keys in env).
 */
export function getDynamoDocClient(): DynamoDBDocumentClient {
  if (cached) return cached;

  const { region } = env.dynamodb;
  const { accessKeyId, secretAccessKey, sessionToken } = env.bedrock;

  const client = new DynamoDBClient({
    region,
    ...(accessKeyId && secretAccessKey
      ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
            ...(sessionToken ? { sessionToken } : {}),
          },
        }
      : {}),
  });

  cached = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return cached;
}

export function bediTableName(): string {
  return env.dynamodb.tableName;
}
