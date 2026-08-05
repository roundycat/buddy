import "server-only";
import { runLlm } from "@/backend/ai/llm-gateway";
import { runPipeline } from "@/backend/ai/agent/agent-run";
import { withBeddySafety } from "@/backend/ai/prompts/safety";
import {
  retrieveChildSummaries,
  type KbHit,
} from "@/backend/ai/kb/retrieve";
import { filterBridgeHits } from "@/backend/ai/bridge/privacy-filter";
import { env } from "@/backend/shared/config/env";
import { extractJsonObject } from "@/backend/shared/llm/parse-json";
import { recordCount } from "@/backend/shared/observability";

/**
 * RAG — Guardian insight retrieval.
 * Query rewrite → parallel KB retrieve → privacy filter → optional broad retry.
 * Not an Agent: no tool-selection loop, no self-repair generation.
 */

/** Drops weak hits; Bedrock scores are often 0–1. Tuned for summary RAG. */
const MIN_TOP_SCORE = 0.15;

export interface GuardianRagResult {
  hits: KbHit[];
  /** Queries actually sent to KB */
  queries: string[];
  rewritten: boolean;
  retried: boolean;
  trace: import("@/backend/ai/agent/agent-run").RunTraceStep[];
}

function dedupeHits(hits: KbHit[]): KbHit[] {
  const seen = new Set<string>();
  const out: KbHit[] = [];
  for (const h of hits) {
    const key = `${h.sourceUri ?? ""}|${h.text.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function isInsufficient(hits: KbHit[]): boolean {
  if (!hits.length) return true;
  const top = Math.max(...hits.map((h) => h.score ?? 0));
  return top < MIN_TOP_SCORE;
}

function broadenQuery(question: string, queries: string[]): string {
  const nouns = question
    .split(/[^0-9a-zA-Z가-힣]+/)
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  if (nouns.length >= 2) return nouns.join(" ");
  return queries[0] || question;
}

async function planQueries(
  question: string
): Promise<{ queries: string[]; rewritten: boolean }> {
  if (env.llmProvider === "mock") {
    return { queries: [question], rewritten: false };
  }
  try {
    const result = await runLlm({
      feature: "rag.guardian.plan-queries",
      purpose: "analysis",
      temperature: 0.2,
      maxTokens: 280,
      messages: [
        {
          role: "system",
          content: withBeddySafety(`당신은 보호자 질문을 Beddy 지식 검색용 질의로 재작성합니다.
아동 요약 문서(감정·미션·메모리·타임라인)에 맞는 한국어 질의 2~3개를 JSON으로만:
{"queries":["...","..."]}`),
        },
        { role: "user", content: question },
      ],
    });
    const parsed = extractJsonObject(result.content) as { queries?: string[] };
    const queries = (parsed.queries ?? [])
      .map((q) => String(q).trim())
      .filter((q) => q.length >= 2)
      .slice(0, 3);
    if (!queries.length) return { queries: [question], rewritten: false };
    return { queries, rewritten: true };
  } catch {
    return { queries: [question], rewritten: false };
  }
}

async function retrieveMany(
  childUserId: string,
  queries: string[],
  maxResults: number
): Promise<KbHit[]> {
  const batches = await Promise.all(
    queries.map((query) =>
      retrieveChildSummaries({
        childUserId,
        query,
        maxResults,
      })
    )
  );
  return filterBridgeHits(
    dedupeHits(batches.flat()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  ).slice(0, maxResults);
}

export async function retrieveGuardianContext(input: {
  childUserId: string;
  question: string;
  maxResults?: number;
  budgetMs?: number;
}): Promise<GuardianRagResult> {
  const maxResults = input.maxResults ?? 5;
  const { result, trace } = await runPipeline(
    {
      feature: "rag.guardian",
      kind: "rag",
      budgetMs: input.budgetMs ?? 3500,
    },
    async (run) => {
      let queries = [input.question.trim()];
      let rewritten = false;

      const planned = await run.stepSafe("rag.guardian.plan_queries", () =>
        planQueries(input.question)
      );
      if (planned?.queries?.length) {
        queries = planned.queries;
        rewritten = planned.rewritten;
        if (rewritten) {
          recordCount("RagQueryRewrites", 1, {
            feature: "rag.guardian",
            operation: "plan_queries",
          });
        }
      } else {
        run.note("rag.guardian.plan_queries", "fallback_original");
      }

      let hits = await run.step("rag.guardian.retrieve", () =>
        retrieveMany(input.childUserId, queries, maxResults)
      );

      const insufficient = isInsufficient(hits);
      run.note(
        "check_sufficiency",
        insufficient ? "insufficient" : `ok top=${hits[0]?.score ?? 0}`
      );

      let retried = false;
      if (insufficient && run.remainingMs() > 1200) {
        const broad = broadenQuery(input.question, queries);
        const retryHits = await run.stepSafe("rag.guardian.retry_broad", () =>
          retrieveMany(input.childUserId, [broad], maxResults)
        );
        retried = true;
        recordCount("RagRetries", 1, {
          feature: "rag.guardian",
          operation: "retry_broad",
        });
        if (retryHits?.length) {
          hits = dedupeHits([...hits, ...retryHits])
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, maxResults);
          queries = [...queries, broad];
        }
      }

      return {
        hits,
        queries,
        rewritten,
        retried,
      };
    }
  );

  return { ...result, trace };
}
