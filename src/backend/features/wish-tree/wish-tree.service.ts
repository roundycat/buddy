import { getWeatherForUser } from "@/backend/features/weather/weather.service";
import { listPhotosForUser } from "@/backend/features/photo-album/photo-album.store";
import { listEmotionRecords } from "@/backend/features/emotion-analysis/emotion.store";
import { listDayStoriesForUser } from "@/backend/features/adventure-quest/adventure-story.service";
import { DomainError } from "@/backend/shared/http/domain-error";
import {
  getWishTreeAccount,
  listWishes,
  saveWishTreeAccount,
} from "./wish-tree.store";
import {
  WISH_KIND_OPTIONS,
  guessWishKind,
  isWishKind,
  leafForKind,
} from "./wish-tree.leaves";
import type {
  LeafShape,
  SkyPhase,
  TreeSeason,
  TreeSky,
  TreeStage,
  WishHorizon,
  WishItem,
  WishKind,
  WishLeafView,
  WishTreeResponse,
} from "./wish-tree.types";

export { listWishes };

const MAX_WISHES = 40;

const SUGGESTIONS: WishTreeResponse["suggestions"] = [
  { emoji: "⚽", text: "친구랑 축구하고 싶어요", horizon: "after_discharge" },
  { emoji: "🐕", text: "강아지 보고 싶어요", horizon: "after_discharge" },
  { emoji: "🎢", text: "엄마랑 놀이공원 가고 싶어요", horizon: "after_discharge" },
  { emoji: "🍦", text: "병실에서 아이스크림 먹고 싶어요", horizon: "hospital" },
  { emoji: "🎮", text: "좋아하는 게임 한판 하고 싶어요", horizon: "anytime" },
];

const STAGE_LABEL: Record<TreeStage, string> = {
  sprout: "새싹 나무",
  young: "어린 나무",
  growing: "자라는 나무",
  full: "무성한 나무",
  ancient: "큰 나무",
};

/** Leaf count at which the tree steps up. */
const STAGE_STEPS: Array<{ from: number; stage: TreeStage }> = [
  { from: 24, stage: "ancient" },
  { from: 12, stage: "full" },
  { from: 6, stage: "growing" },
  { from: 2, stage: "young" },
  { from: 0, stage: "sprout" },
];

export function treeStageFor(leafCount: number): TreeStage {
  return STAGE_STEPS.find((s) => leafCount >= s.from)?.stage ?? "sprout";
}

function leavesUntilNextStage(leafCount: number): number | null {
  const next = [...STAGE_STEPS]
    .reverse()
    .find((s) => s.from > leafCount);
  return next ? next.from - leafCount : null;
}

/** Hour of day in Asia/Seoul — ECS runs on UTC, children do not. */
function seoulNowParts(now = Date.now()): { hour: number; month: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    month: "numeric",
    hour12: false,
  }).format(new Date(now));
  const [month, hour] = fmt.split(",").map((part) => Number(part.trim()));
  return {
    hour: Number.isFinite(hour) ? hour % 24 : 12,
    month: Number.isFinite(month) ? month : 1,
  };
}

function skyPhaseForHour(hour: number): SkyPhase {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

export function seasonForMonth(month: number): TreeSeason {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

async function buildSky(userId: string | undefined): Promise<TreeSky> {
  const phase = skyPhaseForHour(seoulNowParts().hour);
  try {
    const weather = await getWeatherForUser(
      !userId || userId === "anonymous" ? undefined : userId
    );
    return {
      phase,
      weather: weather.code,
      weatherLabel: weather.label,
      weatherEmoji: weather.emoji,
      tempC: weather.tempC ?? null,
    };
  } catch (error) {
    console.warn("[wish-tree] sky weather skipped", error);
    return {
      phase,
      weather: "cloudy",
      weatherLabel: "흐림",
      weatherEmoji: "☁️",
      tempC: null,
    };
  }
}

/** Small stable hash so a leaf always hangs the same way. */
function hashCode(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const GOLDEN_ANGLE = 2.399963229728653;

/**
 * Place a leaf in normalised canopy space [-1, 1].
 * Position depends only on the leaf's own index, so hanging a new leaf never
 * shuffles the ones already on the tree.
 */
function slotFor(index: number, id: string): Pick<
  WishLeafView,
  "nx" | "ny" | "rotate" | "scale"
> {
  const radius = Math.sqrt((index + 0.6) / MAX_WISHES);
  const angle = index * GOLDEN_ANGLE;
  const seed = hashCode(id);
  const jitterX = ((seed % 100) / 100 - 0.5) * 0.12;
  const jitterY = (((seed >> 7) % 100) / 100 - 0.5) * 0.12;

  return {
    nx: clamp(Math.cos(angle) * radius + jitterX, -1, 1),
    ny: clamp(Math.sin(angle) * radius * 0.82 + jitterY, -1, 1),
    rotate: ((seed >> 3) % 37) - 18,
    scale: 0.86 + ((seed >> 11) % 28) / 100,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dateKeyOf(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * How much memory a day holds — drives how brightly its leaf glows.
 * Photos, a finished day story, and a rich conversation each add light.
 */
async function glowByDate(
  userId: string | undefined
): Promise<Map<string, 0 | 1 | 2>> {
  const result = new Map<string, 0 | 1 | 2>();
  if (!userId || userId === "anonymous") return result;

  const [photos, emotions, dayStories] = await Promise.all([
    listPhotosForUser(userId).catch(() => []),
    listEmotionRecords(userId).catch(() => []),
    listDayStoriesForUser(userId).catch(() => []),
  ]);

  const score = new Map<string, number>();
  const bump = (date: string, by: number) =>
    score.set(date, (score.get(date) ?? 0) + by);

  const photoDates = new Set(photos.map((p) => dateKeyOf(p.createdAt)));
  photoDates.forEach((date) => bump(date, 1));
  for (const pack of dayStories) bump(pack.date, 1);

  const emotionCount = new Map<string, number>();
  for (const record of emotions) {
    emotionCount.set(record.dateKey, (emotionCount.get(record.dateKey) ?? 0) + 1);
  }
  emotionCount.forEach((count, date) => {
    if (count >= 2) bump(date, 1);
  });

  score.forEach((value, date) => {
    result.set(date, Math.min(2, value) as 0 | 1 | 2);
  });
  return result;
}

function toLeafView(
  wish: WishItem,
  index: number,
  glow: 0 | 1 | 2
): WishLeafView {
  const kind: WishKind = isWishKind(wish.kind)
    ? wish.kind
    : guessWishKind(wish.text);
  const species = leafForKind(kind);

  return {
    id: wish.id,
    text: wish.text,
    kind,
    shape: species.shape as LeafShape,
    label: species.label,
    emoji: species.emoji,
    horizon: wish.horizon,
    createdAt: wish.createdAt,
    dateKey: dateKeyOf(wish.createdAt),
    glow,
    ...slotFor(index, wish.id),
  };
}

function companionNoteFor(leafCount: number, stage: TreeStage): string {
  if (leafCount === 0) {
    return "아직 잎이 없는 나무예요. 마음에 남는 걸 하나 적으면 잎이 돋아나요.";
  }
  if (stage === "sprout") {
    return "첫 잎이 돋았어요. 바람이 불면 나무가 살짝 흔들려요.";
  }
  if (stage === "young") {
    return `잎이 ${leafCount}장. 나무가 조금씩 모양을 갖춰 가고 있어요.`;
  }
  if (stage === "growing") {
    return `${leafCount}장의 마음이 걸려 있어요. 잎을 누르면 그날이 열려요.`;
  }
  if (stage === "full") {
    return `나무가 무성해졌어요. ${leafCount}장의 잎이 여기서 보낸 날들을 기억하고 있어요.`;
  }
  return `${leafCount}장의 잎이 큰 나무를 이뤘어요. 이 나무는 네가 보낸 모든 날을 기억해요.`;
}

export async function getWishTree(userId?: string): Promise<WishTreeResponse> {
  const wishes = userId ? (await getWishTreeAccount(userId)).wishes : [];
  const glow = await glowByDate(userId);

  // Oldest first so each leaf keeps its slot; newest lands nearest the rim.
  const ordered = [...wishes].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : 1
  );
  const leaves = ordered.map((wish, i) =>
    toLeafView(wish, i, glow.get(dateKeyOf(wish.createdAt)) ?? 0)
  );

  const leafCount = leaves.length;
  const stage = treeStageFor(leafCount);
  const firstDate = ordered[0] ? new Date(ordered[0].createdAt) : null;
  const dayCount = firstDate
    ? Math.max(
        1,
        Math.round((Date.now() - firstDate.getTime()) / 86_400_000) + 1
      )
    : 0;

  return {
    title: "마음 나무",
    companionNote: companionNoteFor(leafCount, stage),
    leaves,
    kinds: WISH_KIND_OPTIONS,
    tree: {
      stage,
      stageLabel: STAGE_LABEL[stage],
      season: seasonForMonth(seoulNowParts().month),
      leafCount,
      dayCount,
      nextStageIn: leavesUntilNextStage(leafCount),
    },
    sky: await buildSky(userId),
    suggestions: SUGGESTIONS,
  };
}

export async function addWish(
  userId: string,
  text: string,
  horizon: WishHorizon = "anytime",
  kind?: WishKind
): Promise<WishTreeResponse> {
  const cleaned = text.trim().slice(0, 80);
  if (cleaned.length < 2) {
    throw new DomainError("마음을 조금 더 적어 주세요.");
  }

  const account = await getWishTreeAccount(userId);
  if (account.wishes.length >= MAX_WISHES) {
    throw new DomainError(
      "나무가 잎으로 가득 찼어요. 하나씩 천천히 이뤄 봐요.",
      "CONFLICT"
    );
  }

  const resolvedKind = isWishKind(kind) ? kind : guessWishKind(cleaned);
  const wish: WishItem = {
    id: `wish-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: cleaned,
    horizon,
    kind: resolvedKind,
    emoji: leafForKind(resolvedKind).emoji,
    createdAt: new Date().toISOString(),
  };

  await saveWishTreeAccount({
    ...account,
    wishes: [wish, ...account.wishes],
  });

  return getWishTree(userId);
}

export async function removeWish(
  userId: string,
  wishId: string
): Promise<WishTreeResponse> {
  const account = await getWishTreeAccount(userId);
  await saveWishTreeAccount({
    ...account,
    wishes: account.wishes.filter((w) => w.id !== wishId),
  });
  return getWishTree(userId);
}

/** For companion prompt + storybook last page */
export async function formatWishesForPrompt(userId: string): Promise<string> {
  const wishes = (await getWishTreeAccount(userId)).wishes;
  if (wishes.length === 0) {
    return "아직 마음 나무에 걸린 잎이 없습니다.";
  }
  return wishes
    .slice(0, 12)
    .map((w) => `- ${w.emoji} ${w.text} (${horizonLabel(w.horizon)})`)
    .join("\n");
}

export function horizonLabel(horizon: WishHorizon): string {
  if (horizon === "hospital") return "병원에서도";
  if (horizon === "after_discharge") return "퇴원하면";
  return "언젠가";
}

/**
 * Aggregate the kinds of longing over a window, without any wish text.
 * Safe for the guardian bridge: categories only, never the child's own words.
 */
export async function summariseWishKinds(
  userId: string,
  days = 7
): Promise<Array<{ kind: WishKind; label: string; count: number }>> {
  const wishes = (await getWishTreeAccount(userId)).wishes;
  const since = Date.now() - days * 86_400_000;
  const counts = new Map<WishKind, number>();

  for (const wish of wishes) {
    if (new Date(wish.createdAt).getTime() < since) continue;
    const kind = isWishKind(wish.kind) ? wish.kind : guessWishKind(wish.text);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }

  const rows: Array<{ kind: WishKind; label: string; count: number }> = [];
  counts.forEach((count, kind) => {
    rows.push({ kind, label: leafForKind(kind).label, count });
  });
  return rows.sort((a, b) => b.count - a.count);
}

export async function buildWishClosingPage(userId: string): Promise<{
  title: string;
  headline: string;
  body: string;
  wishes: Array<{ emoji: string; text: string }>;
} | null> {
  const wishes = (await getWishTreeAccount(userId)).wishes;
  if (wishes.length === 0) return null;

  const lines = wishes
    .slice(0, 10)
    .map((w) => `${w.emoji} ${w.text}`)
    .join("\n");

  return {
    title: "마음 나무의 마지막 장",
    headline: "🌳 이 나무가 기억하는 것들",
    body: `이 나무는 네가 여기서 보낸 용감한 날들을 전부 기억하고 있어.\n\n${lines}\n\n이제 병원 밖에서 하나씩 이루러 가자. 급할 필요 없어. 천천히, 하나씩. 베디도 응원할게.`,
    wishes: wishes.slice(0, 10).map((w) => ({
      emoji: w.emoji,
      text: w.text,
    })),
  };
}
