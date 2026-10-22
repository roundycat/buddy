import "server-only";
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  type KnowledgeBaseRetrievalResult,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { env } from "@/backend/shared/config/env";
import { observeKbSearch } from "@/backend/ai/llm-gateway";
import { logObservation, newRequestId, recordCount } from "@/backend/shared/observability";
import { isLocalKbMode, latestLocalSummaryAt, searchLocalSummaries } from "./local-kb";
import { indexChildSummariesForKb } from "./index-summaries";

export type KbHit = {
  text: string;
  score?: number;
  sourceUri?: string;
  sourceLabel: string;
};

let client: BedrockAgentRuntimeClient | null = null;

function getClient() {
  if (!client) {
    client = new BedrockAgentRuntimeClient({
      region: env.bedrock.region,
      ...(env.bedrock.accessKeyId && env.bedrock.secretAccessKey
        ? {
            credentials: {
              accessKeyId: env.bedrock.accessKeyId,
              secretAccessKey: env.bedrock.secretAccessKey,
              ...(env.bedrock.sessionToken
                ? { sessionToken: env.bedrock.sessionToken }
                : {}),
            },
          }
        : {}),
    });
  }
  return client;
}

function labelFromUri(uri?: string): string {
  if (!uri) return "지식 요약";
  if (uri.includes("memory")) return "학습된 대화 메모리";
  if (uri.includes("emotion") || uri.includes("garden")) return "감정 이력";
  if (uri.includes("mission") || uri.includes("adventure")) return "미션 이력";
  if (uri.includes("timeline")) return "타임라인";
  if (uri.includes("wish")) return "관심사·소원";
  if (uri.includes("parent") || uri.includes("observation"))
    return "보호자 관찰";
  return "지식 요약";
}

function hitFromResult(r: KnowledgeBaseRetrievalResult): KbHit | null {
  const text = r.content?.text?.trim() ?? "";
  if (!text) return null;
  const uri = r.location?.s3Location?.uri ?? r.location?.webLocation?.url;
  return {
    text: text.slice(0, 800),
    score: r.score,
    sourceUri: uri,
    sourceLabel: labelFromUri(uri),
  };
}

/**
 * Retrieve privacy-safe summary chunks for a child.
 * Filters to S3 keys under kb-summaries/{childUserId}/ so raw chat never leaks cross-child.
 */
/** Local mode refreshes a child's summaries at most this often (no LLM, file writes only). */
const LOCAL_REFRESH_MS = 20 * 60_000;
const localRefreshAt = new Map<string, number>();

async function refreshLocalSummaries(childUserId: string) {
  const now = Date.now();
  const last = Math.max(localRefreshAt.get(childUserId) ?? 0, latestLocalSummaryAt(childUserId));
  if (now - last < LOCAL_REFRESH_MS) return;
  localRefreshAt.set(childUserId, now);
  await indexChildSummariesForKb(childUserId).catch((error) => {
    console.warn("[kb.local] refresh failed", error);
  });
}

export async function retrieveChildSummaries(input: {
  childUserId: string;
  query: string;
  maxResults?: number;
}): Promise<KbHit[]> {
  if (isLocalKbMode()) {
    if (!input.query.trim()) return [];
    return observeKbSearch("kb.retrieve.local", async () => {
      // Guardian questions see today's summaries, not only the dawn batch's.
      await refreshLocalSummaries(input.childUserId);
      return searchLocalSummaries({
        childUserId: input.childUserId,
        query: input.query,
        maxResults: input.maxResults ?? 6,
      });
    });
  }

  const kbId = env.bedrock.knowledgeBaseId;
  if (!kbId || !input.query.trim()) return [];

  const needle = `kb-summaries/${input.childUserId}/`;
  const maxResults = input.maxResults ?? 6;

  return observeKbSearch("kb.retrieve", async () => {
    try {
      const res = await getClient().send(
        new RetrieveCommand({
          knowledgeBaseId: kbId,
          retrievalQuery: { text: input.query.slice(0, 500) },
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: Math.min(12, maxResults * 2),
            },
          },
        })
      );

      const hits: KbHit[] = [];
      let dropped = 0;
      for (const r of res.retrievalResults ?? []) {
        const hit = hitFromResult(r);
        if (!hit) continue;
        const uri = hit.sourceUri ?? "";
        // Strict owner scope: only docs under kb-summaries/{childUserId}/
        if (!uri.includes(needle)) {
          dropped += 1;
          continue;
        }
        hits.push(hit);
        if (hits.length >= maxResults) break;
      }
      if (dropped > 0) {
        const requestId = newRequestId();
        logObservation({
          feature: "kb.retrieve",
          operation: "owner_filter",
          success: true,
          requestId,
          message: `dropped_cross_child_hits=${dropped}`,
        });
        recordCount("KbCrossChildDrops", dropped, {
          feature: "kb.retrieve",
          operation: "owner_filter",
        });
      }
      return hits;
    } catch (error) {
      console.error("[kb.retrieve]", error);
      return [];
    }
  });
}

export function formatKbHitsForPrompt(hits: KbHit[]): string {
  if (!hits.length) return "(관련 요약 없음)";
  return hits
    .map((h, i) => `[${i + 1}] (${h.sourceLabel}) ${h.text}`)
    .join("\n");
}

export function kbSourceLabels(hits: KbHit[]): string[] {
  return Array.from(new Set(hits.map((h) => h.sourceLabel)));
}

export function isKbConfigured(): boolean {
  return Boolean(env.bedrock.knowledgeBaseId) || isLocalKbMode();
}
