import { NextResponse } from "next/server";
import { UnauthorizedError, unauthorizedJson } from "@/backend/shared/http/auth";

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

export async function withApiGuard<T>(
  handler: ApiHandler<T>,
  fallbackMessage: string,
  logTag: string,
  status = 500,
  mapError?: ErrorMapper
) {
  try {
    const data = await handler();
    if (data instanceof NextResponse) {
      return data;
    }
    return NextResponse.json(data);
  } catch (error) {
    const mapped = mapError?.(error);
    if (mapped) return mapped;
    if (error instanceof UnauthorizedError) return unauthorizedJson(error);
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
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
