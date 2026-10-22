import "server-only";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "@/backend/shared/config/env";
import { todayKey } from "@/backend/shared/time/date";
import { getConversationMemory } from "@/backend/features/conversation/conversation.store";
import { getGardenAccount } from "@/backend/features/emotion-garden/emotion-garden.store";
import { MOOD_OPTIONS } from "@/backend/features/emotion-garden/emotion-garden.service";
import { getAdventureQuest } from "@/backend/features/adventure-quest/adventure-quest.service";
import { getWishTreeAccount } from "@/backend/features/wish-tree/wish-tree.store";
import { getMemoryTimeline } from "@/backend/features/memory-timeline/memory-timeline.service";
import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import { filterBridgeText } from "@/backend/ai/bridge/privacy-filter";
import { guardGuardianText } from "@/backend/ai/bridge/leak-guard";
import { recentChildWording } from "@/backend/ai/bridge/child-wording";
import { clearLocalSummariesForChild, isLocalKbMode, putLocalSummaryDoc } from "./local-kb";

/**
 * Write privacy-safe summary documents for guardian Q&A retrieval.
 * AWS: S3 kb-summaries/{childUserId}/{dateKey}-{kind}.md → Bedrock KB ingestion.
 * Elsewhere (no BEDROCK_KB_ID): the same documents in the data directory,
 * searched by ./local-kb.
 * Never writes raw chat transcripts.
 */

let s3: S3Client | null = null;

function getS3() {
  if (!s3) {
    s3 = new S3Client({
      region: env.avatar.s3Region || env.dynamodb.region,
    });
  }
  return s3;
}

function bucket(): string | null {
  return env.avatar.s3Bucket || null;
}

function target(): "s3" | "local" | null {
  if (isLocalKbMode()) return "local";
  return bucket() ? "s3" : null;
}

/**
 * Guardian RAG reads these docs, so each line passes the leak guard against
 * the child's own recent chat; a line that would leak is dropped.
 */
function guardKbBody(body: string, childWording: string[]): string {
  return body
    .split("\n")
    .map((line) => guardGuardianText(line, childWording, "").text)
    .filter((line) => line.trim())
    .join("\n");
}

async function putSummaryDoc(input: {
  childUserId: string;
  dateKey: string;
  kind: string;
  title: string;
  body: string;
}): Promise<boolean> {
  const where = target();
  if (!where) return false;
  const cleaned = filterBridgeText(input.body);
  if (!cleaned) return false;

  const key = `kb-summaries/${input.childUserId}/${input.dateKey}-${input.kind}.md`;
  const body = `# ${input.title}\n\nchildUserId: ${input.childUserId}\ndate: ${input.dateKey}\nkind: ${input.kind}\n\n${cleaned}\n`;

  if (where === "local") {
    putLocalSummaryDoc({
      childUserId: input.childUserId,
      dateKey: input.dateKey,
      kind: input.kind,
      markdown: body,
    });
    return true;
  }
  const b = bucket()!;

  await getS3().send(
    new PutObjectCommand({
      Bucket: b,
      Key: key,
      Body: body,
      ContentType: "text/markdown; charset=utf-8",
      Metadata: {
        childuserid: input.childUserId,
        kind: input.kind,
        datekey: input.dateKey,
      },
    })
  );
  return true;
}

export async function indexChildSummariesForKb(
  childUserId: string,
  dateKey = todayKey()
): Promise<{ ok: boolean; docs: number }> {
  if (!target()) {
    return { ok: true, docs: 0 };
  }

  try {
    const [memory, garden, adventure, wishes, timeline, persona] =
      await Promise.all([
        getConversationMemory(childUserId),
        getGardenAccount(childUserId),
        getAdventureQuest(childUserId),
        getWishTreeAccount(childUserId),
        getMemoryTimeline(childUserId),
        getPersonaForUser(childUserId),
      ]);
    const childWording = await recentChildWording(childUserId, {
      exclude: [persona.self?.nickname, persona.profile?.nickname, persona.name],
    });
    const guard = (body: string) => guardKbBody(body, childWording);

    let docs = 0;

    const facts = (memory.persistentFacts ?? [])
      .map((f) => `- (${f.importance}) ${f.text}`)
      .join("\n");
    const memoryBody = [
      `어투: ${memory.speechStyleNotes || "없음"}`,
      `톤: ${(memory.preferredToneNotes ?? []).slice(-4).join("; ") || "없음"}`,
      `감정 테마: ${(memory.emotionalThemes ?? []).slice(-6).join(", ") || "없음"}`,
      facts ? `영속 사실:\n${facts}` : "영속 사실: 없음",
    ].join("\n");
    if (
      await putSummaryDoc({
        childUserId,
        dateKey,
        kind: "memory",
        title: "대화 학습 메모리 요약",
        body: guard(memoryBody),
      })
    )
      docs += 1;

    const recentFlowers = [...garden.flowers]
      .sort((a, b) => a.plantedOn.localeCompare(b.plantedOn))
      .slice(-14)
      .map((f) => {
        const label = MOOD_OPTIONS.find((m) => m.id === f.mood)?.label ?? f.mood;
        return `- ${f.plantedOn}: ${label}`;
      })
      .join("\n");
    if (
      recentFlowers &&
      (await putSummaryDoc({
        childUserId,
        dateKey,
        kind: "emotion",
        title: "감정 이력 요약",
        body: guard(recentFlowers),
      }))
    )
      docs += 1;

    const missions = adventure.quests
      .map((q) => `- [${q.status}] ${q.emoji ?? ""} ${q.title}`)
      .join("\n");
    const missionBody = [
      adventure.headline ? `헤드라인: ${adventure.headline}` : "",
      missions || "미션 없음",
      adventure.dayStory?.narrative
        ? `하루 이야기(요약): ${adventure.dayStory.narrative.slice(0, 200)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (
      await putSummaryDoc({
        childUserId,
        dateKey,
        kind: "mission",
        title: "미션·모험 이력",
        body: guard(missionBody),
      })
    )
      docs += 1;

    const timelineBody = timeline.events
      .slice(0, 12)
      .map((e) => `- ${e.title}${e.summary ? `: ${e.summary.slice(0, 120)}` : ""}`)
      .join("\n");
    if (
      timelineBody &&
      (await putSummaryDoc({
        childUserId,
        dateKey,
        kind: "timeline",
        title: "타임라인 하이라이트",
        body: guard(timelineBody),
      }))
    )
      docs += 1;

    const interests = [
      persona.self?.disposition,
      ...(wishes.wishes ?? [])
        .slice(0, 8)
        .map((w) => `소원: ${w.text.slice(0, 80)}`),
    ]
      .filter(Boolean)
      .join("\n");
    if (
      interests &&
      (await putSummaryDoc({
        childUserId,
        dateKey,
        kind: "interests",
        title: "관심사·소원 요약",
        body: guard(interests),
      }))
    )
      docs += 1;

    return { ok: true, docs };
  } catch (error) {
    console.error("[kb.index]", childUserId, error);
    return { ok: false, docs: 0 };
  }
}

/**
 * Delete a child's summary documents everywhere they may live (local data
 * directory and the S3 prefix the Knowledge Base ingests). The next KB sync
 * drops them from the index.
 */
export async function clearKbSummariesForChild(childUserId: string): Promise<void> {
  await clearLocalSummariesForChild(childUserId);
  const b = bucket();
  if (!b) return;
  const Prefix = `kb-summaries/${childUserId}/`;
  let ContinuationToken: string | undefined;
  do {
    const page = await getS3().send(
      new ListObjectsV2Command({ Bucket: b, Prefix, ContinuationToken })
    );
    const keys = (page.Contents ?? []).map((o) => o.Key).filter(Boolean) as string[];
    if (keys.length) {
      await getS3().send(
        new DeleteObjectsCommand({
          Bucket: b,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        })
      );
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
}
