import "server-only";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "fs";
import path from "path";
import { env } from "@/backend/shared/config/env";
import { dataDir } from "@/backend/shared/persist/json-file";
import { sanitizeBlobId } from "@/backend/shared/persist/blob-store";

/**
 * Local summary search — stands in for the Bedrock Knowledge Base when the
 * service runs outside AWS (no BEDROCK_KB_ID).
 *
 * The same privacy-safe summary documents the dawn batch writes to S3 are kept
 * under `${BEDDY_DATA_DIR}/kb-summaries/<childUserId>/<date>-<kind>.md`. One
 * child's documents are a few dozen short files, so a lexical score (Hangul
 * syllable bigrams + words) with a recency bonus is enough; there is no vector
 * index to keep in sync and nothing leaves the server.
 */

export type LocalKbHit = {
  text: string;
  score: number;
  sourceUri: string;
  sourceLabel: string;
};

const KIND_LABEL: Record<string, string> = {
  memory: "학습된 대화 메모리",
  emotion: "감정 이력",
  mission: "미션 이력",
  timeline: "타임라인",
  interests: "관심사·소원",
};

const KIND_HINTS: Array<[string, RegExp]> = [
  ["emotion", /(감정|기분|마음|정서|우울|불안|슬프|행복|웃|울)/],
  ["mission", /(미션|모험|활동|과제|도전|퀘스트)/],
  ["interests", /(소원|관심|좋아하|취미|꿈|하고\s?싶)/],
  ["memory", /(대화|이야기|말투|기억|친구|고민)/],
  ["timeline", /(최근|요즘|하루|일상|타임라인|있었던)/],
];

/** Keep at most this many days of documents per child in the search. */
const MAX_DAYS = 21;

function childDir(childUserId: string) {
  return path.join(dataDir(), "kb-summaries", sanitizeBlobId(childUserId));
}

/** No Bedrock Knowledge Base configured → summaries are searched on this server. */
export function isLocalKbMode(): boolean {
  return !env.bedrock.knowledgeBaseId;
}

export function putLocalSummaryDoc(input: {
  childUserId: string;
  dateKey: string;
  kind: string;
  markdown: string;
}): void {
  const dir = childDir(input.childUserId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${input.dateKey}-${sanitizeBlobId(input.kind)}.md`);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, input.markdown, "utf8");
  renameSync(tmp, file);
}

/** Newest document time for a child (ms), or 0. */
export function latestLocalSummaryAt(childUserId: string): number {
  const dir = childDir(childUserId);
  if (!existsSync(dir)) return 0;
  let latest = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    latest = Math.max(latest, statSync(path.join(dir, name)).mtimeMs);
  }
  return latest;
}

function grams(text: string): Set<string> {
  const out = new Set<string>();
  const lower = text.toLowerCase();
  for (const word of lower.split(/[^0-9a-z가-힣]+/)) {
    if (word.length >= 2) out.add(`w:${word}`);
  }
  const hangul = lower.replace(/[^가-힣]/g, "");
  for (let i = 0; i + 1 < hangul.length; i++) out.add(`b:${hangul.slice(i, i + 2)}`);
  return out;
}

function bodyOf(markdown: string): string {
  // Drop the "# title" line and the childUserId/date/kind header lines.
  return markdown
    .split("\n")
    .filter((line) => !/^(childUserId|date|kind):/.test(line))
    .join("\n")
    .trim();
}

export function searchLocalSummaries(input: {
  childUserId: string;
  query: string;
  maxResults?: number;
}): LocalKbHit[] {
  const dir = childDir(input.childUserId);
  if (!existsSync(dir) || !input.query.trim()) return [];

  const files = readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}-[\w-]+\.md$/.test(name))
    .sort()
    .reverse();
  if (!files.length) return [];

  const days = Array.from(new Set(files.map((f) => f.slice(0, 10)))).slice(0, MAX_DAYS);
  const newestDay = days[0];
  const query = grams(input.query);
  const hintedKinds = new Set(
    KIND_HINTS.filter(([, re]) => re.test(input.query)).map(([kind]) => kind)
  );

  const hits: LocalKbHit[] = [];
  for (const name of files) {
    const day = name.slice(0, 10);
    if (!days.includes(day)) continue;
    const kind = name.slice(11, -3);
    const markdown = readFileSync(path.join(dir, name), "utf8");
    const text = bodyOf(markdown);
    if (!text) continue;

    const doc = grams(text);
    let overlap = 0;
    query.forEach((g) => {
      if (doc.has(g)) overlap += 1;
    });
    const lexical = query.size ? overlap / query.size : 0;
    const recency = day === newestDay ? 0.15 : Math.max(0, 0.1 - days.indexOf(day) * 0.01);
    const hint = hintedKinds.has(kind) ? 0.25 : 0;
    const score = Math.min(1, lexical * 0.6 + recency + hint);

    hits.push({
      text: text.slice(0, 800),
      score: Number(score.toFixed(3)),
      sourceUri: `local://kb-summaries/${sanitizeBlobId(input.childUserId)}/${name}`,
      sourceLabel: KIND_LABEL[kind] ?? "지식 요약",
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, input.maxResults ?? 6);
}
