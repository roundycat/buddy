import "server-only";
import { todayKey } from "@/backend/shared/time/date";
import { indexChildSummariesForKb } from "@/backend/ai/kb/index-summaries";

/**
 * Job 4 — Push privacy-safe summaries to S3 for Bedrock KB (STEP 6).
 */
export async function indexKbSummariesForUser(
  userId: string,
  dateKey = todayKey()
): Promise<{ userId: string; ok: boolean; docs: number }> {
  const r = await indexChildSummariesForKb(userId, dateKey);
  return { userId, ok: r.ok, docs: r.docs };
}
