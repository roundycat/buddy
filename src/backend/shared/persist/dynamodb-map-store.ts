import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { bediTableName, getDynamoDocClient } from "./dynamodb-client";
import { observeAsync } from "@/backend/shared/observability";

/** Map store records may carry ISO expiresAt → top-level DynamoDB TTL (epoch sec). */
function ttlFromValue(value: object): { ttl?: number } {
  const expiresAt = (value as { expiresAt?: unknown }).expiresAt;
  if (typeof expiresAt !== "string" || !expiresAt) return {};
  const ms = Date.parse(expiresAt);
  if (!Number.isFinite(ms)) return {};
  return { ttl: Math.floor(ms / 1000) };
}

/**
 * DynamoDB-backed key/value map for a namespace (single-table design).
 * pk = MAP#<namespace>, sk = <id>, payload in `data`
 */
export function createDynamoMapStore<T extends object>(namespace: string) {
  const pk = `MAP#${namespace.replace(/\.json$/i, "")}`;
  const ns = namespace.replace(/\.json$/i, "");
  const table = () => bediTableName();
  const doc = () => getDynamoDocClient();

  return {
    async getAsync(id: string): Promise<T | undefined> {
      return observeAsync(
        {
          feature: `ddb.${ns}`,
          operation: "get",
          latencyMetric: "DynamoLatencyMs",
        },
        async () => {
          const res = await doc().send(
            new GetCommand({
              TableName: table(),
              Key: { pk, sk: id },
            })
          );
          return (res.Item?.data as T | undefined) ?? undefined;
        }
      );
    },

    async setAsync(id: string, value: T): Promise<T> {
      return observeAsync(
        {
          feature: `ddb.${ns}`,
          operation: "put",
          latencyMetric: "DynamoLatencyMs",
        },
        async () => {
          await doc().send(
            new PutCommand({
              TableName: table(),
              Item: {
                pk,
                sk: id,
                data: value,
                updatedAt: new Date().toISOString(),
                // Soft TTL fields (e.g. coarse-locations expiresAt) → DynamoDB TTL attr
                ...ttlFromValue(value),
              },
            })
          );
          return value;
        }
      );
    },

    async deleteAsync(id: string) {
      await doc().send(
        new DeleteCommand({
          TableName: table(),
          Key: { pk, sk: id },
        })
      );
    },

    async hasAsync(id: string): Promise<boolean> {
      const item = await this.getAsync(id);
      return Boolean(item);
    },

    async valuesAsync(): Promise<T[]> {
      const res = await doc().send(
        new QueryCommand({
          TableName: table(),
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": pk },
        })
      );
      return (res.Items ?? []).map((item) => item.data as T);
    },

    async entriesAsync(): Promise<Array<[string, T]>> {
      const res = await doc().send(
        new QueryCommand({
          TableName: table(),
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": pk },
        })
      );
      return (res.Items ?? []).map((item) => [String(item.sk), item.data as T]);
    },

    async clearByUserIdAsync(userId: string, userIdKey = "userId") {
      const entries = await this.entriesAsync();
      await Promise.all(
        entries
          .filter(([id, value]) => {
            const record = value as Record<string, unknown>;
            return record[userIdKey] === userId || id.startsWith(`${userId}:`);
          })
          .map(([id]) => this.deleteAsync(id))
      );
    },

    async clearAllAsync() {
      const entries = await this.entriesAsync();
      await Promise.all(entries.map(([id]) => this.deleteAsync(id)));
    },
  };
}

/** Dev utility: scan table (avoid in hot paths) */
export async function scanBediTableSample(limit = 20) {
  const res = await getDynamoDocClient().send(
    new ScanCommand({
      TableName: bediTableName(),
      Limit: limit,
    })
  );
  return res.Items ?? [];
}
