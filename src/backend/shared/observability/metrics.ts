import "server-only";
import {
  CloudWatchClient,
  PutMetricDataCommand,
  StandardUnit,
  type MetricDatum,
} from "@aws-sdk/client-cloudwatch";
import { env } from "@/backend/shared/config/env";

export const BEDDY_METRIC_NAMESPACE = "Beddy";

let client: CloudWatchClient | null = null;

function getClient(): CloudWatchClient {
  if (client) return client;
  const { region, accessKeyId, secretAccessKey, sessionToken } = env.bedrock;
  client = new CloudWatchClient({
    region: env.dynamodb.region || region,
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
  return client;
}

function dim(name: string, value: string) {
  return { Name: name, Value: value.slice(0, 256) };
}

/**
 * Fire-and-forget custom metrics. Failures are logged once; never throw to callers.
 */
export function putBeddyMetrics(
  metrics: Array<{
    name: string;
    value: number;
    unit?: StandardUnit | string;
    feature?: string;
    model?: string;
    operation?: string;
  }>
): void {
  if (!metrics.length) return;
  if (process.env.BEDDY_METRICS === "0") return;

  const Datum: MetricDatum[] = metrics.map((m) => {
    const Dimensions = [];
    if (m.feature) Dimensions.push(dim("Feature", m.feature));
    if (m.model) Dimensions.push(dim("Model", m.model));
    if (m.operation) Dimensions.push(dim("Operation", m.operation));
    return {
      MetricName: m.name,
      Value: m.value,
      Unit: (m.unit as StandardUnit) || StandardUnit.None,
      Timestamp: new Date(),
      ...(Dimensions.length ? { Dimensions } : {}),
    };
  });

  void getClient()
    .send(
      new PutMetricDataCommand({
        Namespace: BEDDY_METRIC_NAMESPACE,
        MetricData: Datum,
      })
    )
    .catch((error) => {
      console.error(
        "[bedi:metrics] PutMetricData failed",
        error instanceof Error ? error.message : error
      );
    });
}

export function recordLatency(
  metricName: string,
  latencyMs: number,
  dims: { feature: string; model?: string; operation?: string }
): void {
  putBeddyMetrics([
    {
      name: metricName,
      value: latencyMs,
      unit: StandardUnit.Milliseconds,
      ...dims,
    },
  ]);
}

export function recordCount(
  metricName: string,
  value: number,
  dims: { feature: string; model?: string; operation?: string }
): void {
  putBeddyMetrics([
    {
      name: metricName,
      value,
      unit: StandardUnit.Count,
      ...dims,
    },
  ]);
}
