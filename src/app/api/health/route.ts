import { NextResponse } from "next/server";
import { getLlmStatus } from "@/backend/shared/llm";
import { env } from "@/backend/shared/config/env";
import { timingSafeEqual } from "crypto";
import { clientAddress } from "@/backend/shared/http/rate-limit";

/** Always reflect live env — never bake at build time. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

function mayRevealDetail(request: Request): boolean {
  // Local/dev: full payload for debugging.
  if (process.env.NODE_ENV !== "production") return true;

  // Production: only with cron/health secret — never public infra disclosure.
  const expected = env.cronSecret;
  if (!expected) return false;
  const got =
    request.headers.get("x-bedi-health-secret")?.trim() ||
    request.headers.get("x-bedi-cron-secret")?.trim() ||
    "";
  if (!got || got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Liveness probe — always safe for ALB / unauthenticated callers.
 * Detailed LLM/persistence wiring requires a shared secret header in production.
 */
export async function GET(request: Request) {
  const base = {
    ok: true as const,
    service: "bedi",
    time: new Date().toISOString(),
    // ?client=1 shows the caller their own address as the rate limits see it
    // (a deployment check that the proxy headers are read the right way).
    ...(new URL(request.url).searchParams.get("client") === "1"
      ? { client: clientAddress(request) }
      : {}),
  };

  if (!mayRevealDetail(request)) {
    return NextResponse.json(base);
  }

  const llm = getLlmStatus();
  return NextResponse.json({
    ...base,
    appUrl: env.appUrl,
    persistence: env.persistence,
    authProvider: env.authProvider,
    dynamodbTable: env.dynamodb.tableName,
    llmFallbackToMock: env.llmFallbackToMock,
    llm,
  });
}
