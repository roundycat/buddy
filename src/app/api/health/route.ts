import { NextResponse } from "next/server";
import { getLlmStatus } from "@/backend/shared/llm";
import { env } from "@/backend/shared/config/env";

/** Always reflect live env (Bedrock/Aurora) — never bake at build time. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Health / integration status.
 * Use this to verify LLM + env wiring before chatting.
 */
export async function GET() {
  const llm = getLlmStatus();

  return NextResponse.json({
    ok: true,
    service: "bedi",
    time: new Date().toISOString(),
    appUrl: env.appUrl,
    llm,
  });
}
