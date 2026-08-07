import { NextResponse } from "next/server";
import { UnauthorizedError, unauthorizedJson } from "@/backend/shared/http/auth";
import {
  DomainError,
  domainStatus,
} from "@/backend/shared/http/domain-error";
import { putBeddyMetrics } from "@/backend/shared/observability";
import { StandardUnit } from "@aws-sdk/client-cloudwatch";

type ApiHandler<T> = () => Promise<T>;
type ErrorMapper = (error: unknown) => NextResponse | null;

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export { DomainError } from "@/backend/shared/http/domain-error";

function emitApiMetrics(logTag: string, latencyMs: number, ok: boolean) {
  const feature = logTag.replace(/^\[|\]$/g, "").slice(0, 64) || "api";
  putBeddyMetrics([
    {
      name: "ApiLatencyMs",
      value: latencyMs,
      unit: StandardUnit.Milliseconds,
      feature,
      operation: "http",
    },
    {
      name: "ApiInvocations",
      value: 1,
      unit: StandardUnit.Count,
      feature,
      operation: "http",
    },
    ...(ok
      ? []
      : [
          {
            name: "ApiErrors",
            value: 1,
            unit: StandardUnit.Count,
            feature,
            operation: "http",
          },
        ]),
  ]);
}

export async function withApiGuard<T>(
  handler: ApiHandler<T>,
  fallbackMessage: string,
  logTag: string,
  status = 500,
  mapError?: ErrorMapper
) {
  const started = Date.now();
  try {
    const data = await handler();
    emitApiMetrics(logTag, Date.now() - started, true);
    if (data instanceof NextResponse) {
      return data;
    }
    return NextResponse.json(data);
  } catch (error) {
    emitApiMetrics(logTag, Date.now() - started, false);
    const mapped = mapError?.(error);
    if (mapped) return mapped;
    if (error instanceof UnauthorizedError) return unauthorizedJson(error);
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error: error.message },
        { status: domainStatus(error) }
      );
    }
    console.error(logTag, error);
    return NextResponse.json(
      {
        error: fallbackMessage,
      },
      { status }
    );
  }
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
