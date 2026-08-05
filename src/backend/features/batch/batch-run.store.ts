import "server-only";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { isDynamoPersistence } from "@/backend/shared/config/env";
import {
  bediTableName,
  getDynamoDocClient,
} from "@/backend/shared/persist/dynamodb-client";
import { createMapStore } from "@/backend/shared/persist/map-store";

export type BatchRunStatus = "started" | "done" | "failed";

export interface BatchRunRecord {
  dateKey: string;
  status: BatchRunStatus;
  startedAt: string;
  finishedAt?: string;
}

const PK = "BATCH#daily";
const jsonStore = createMapStore<BatchRunRecord>("batch-runs.json", {
  userIdKey: "dateKey",
});

function isConditionalFail(error: unknown): boolean {
  const name =
    typeof error === "object" && error && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  return name === "ConditionalCheckFailedException";
}

/**
 * Atomically claim a dawn-batch run for dateKey.
 * Returns skipped when already started/done (unless force).
 * Failed markers may be reclaimed.
 */
export async function tryClaimDailyBatchRun(
  dateKey: string,
  force = false
): Promise<{ claimed: boolean; skipped: boolean; record?: BatchRunRecord }> {
  const now = new Date().toISOString();
  const next: BatchRunRecord = {
    dateKey,
    status: "started",
    startedAt: now,
  };

  if (!isDynamoPersistence()) {
    const existing = await jsonStore.get(dateKey);
    if (
      !force &&
      existing &&
      (existing.status === "started" || existing.status === "done")
    ) {
      return { claimed: false, skipped: true, record: existing };
    }
    await jsonStore.set(dateKey, next);
    return { claimed: true, skipped: false, record: next };
  }

  const doc = getDynamoDocClient();
  const table = bediTableName();

  try {
    await doc.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk: PK,
          sk: dateKey,
          data: next,
          updatedAt: now,
        },
        ...(force
          ? {}
          : {
              ConditionExpression:
                "attribute_not_exists(pk) OR #data.#st = :failed",
              ExpressionAttributeNames: {
                "#data": "data",
                "#st": "status",
              },
              ExpressionAttributeValues: {
                ":failed": "failed",
              },
            }),
      })
    );
    return { claimed: true, skipped: false, record: next };
  } catch (error) {
    if (!force && isConditionalFail(error)) {
      const existing = await getDailyBatchRun(dateKey);
      return { claimed: false, skipped: true, record: existing ?? undefined };
    }
    throw error;
  }
}

export async function getDailyBatchRun(
  dateKey: string
): Promise<BatchRunRecord | null> {
  if (!isDynamoPersistence()) {
    return (await jsonStore.get(dateKey)) ?? null;
  }
  const res = await getDynamoDocClient().send(
    new GetCommand({
      TableName: bediTableName(),
      Key: { pk: PK, sk: dateKey },
    })
  );
  return (res.Item?.data as BatchRunRecord | undefined) ?? null;
}

export async function markDailyBatchRun(
  dateKey: string,
  status: "done" | "failed"
): Promise<void> {
  const finishedAt = new Date().toISOString();

  if (!isDynamoPersistence()) {
    const existing = (await jsonStore.get(dateKey)) ?? {
      dateKey,
      status: "started" as const,
      startedAt: finishedAt,
    };
    await jsonStore.set(dateKey, { ...existing, status, finishedAt });
    return;
  }

  await getDynamoDocClient().send(
    new UpdateCommand({
      TableName: bediTableName(),
      Key: { pk: PK, sk: dateKey },
      UpdateExpression:
        "SET #data.#st = :status, #data.finishedAt = :finishedAt, updatedAt = :finishedAt",
      ExpressionAttributeNames: {
        "#data": "data",
        "#st": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":finishedAt": finishedAt,
      },
    })
  );
}
