import { getBondRecord, saveBondRecord } from "./bond.store";
import type {
  BondAction,
  CareType,
  CompanionBondRecord,
  CompanionBondView,
  CompanionMoodId,
} from "./bond.types";

const PET_DAILY_CAP = 8;
const CHAT_DAILY_CAP = 5;
const CARE_GAIN = 2;
const PET_GAIN = 1;
const CHAT_GAIN = 1;
const VISIT_GAIN = 2;
const QUEST_GAIN = 5;

const MOODS: Array<{
  id: CompanionMoodId;
  label: string;
  hint: string;
}> = [
  { id: "cozy", label: "포근해요", hint: "오늘 옆에만 있어도 든든해." },
  { id: "sleepy", label: "나른해요", hint: "천천히 숨 쉬어도 괜찮아." },
  { id: "sparkly", label: "반짝여요", hint: "작은 일도 반짝일 수 있어." },
  { id: "brave", label: "용기가 나요", hint: "조금만 더, 같이 가 보자." },
  { id: "calm", label: "고요해요", hint: "조용히 곁에 있을게." },
  { id: "curious", label: "궁금해요", hint: "네 이야기, 듣고 싶어." },
];

const AFFINITY_LABELS: Array<{ min: number; label: string }> = [
  { min: 80, label: "든든한 사이" },
  { min: 50, label: "친해지는 중" },
  { min: 20, label: "알아가는 중" },
  { min: 0, label: "처음 만나는 중" },
];

const ACTION_LINES: Record<BondAction | CareType, string[]> = {
  visit: [
    "오늘도 와 줘서 고마워.",
    "다시 보네. 여기 있어.",
    "네가 오니까 방이 조금 따뜻해졌어.",
  ],
  pet: [
    "네가 만져 줘서 든든해.",
    "간지러워… 좋아.",
    "그렇게 쓰다듬어 주면 마음이 풀려.",
  ],
  care: ["챙겨 줘서 고마워.", "네가 챙겨 주니까 힘이 나."],
  cheer: [
    "응원 받아 챙이네. 너도 잘하고 있어.",
    "네 응원이 나한테도 닿았어.",
  ],
  hug: ["꼭 안아 줘서 든든해.", "이 안아줌, 오래 기억할게."],
  stay: ["그냥 같이 있어 줘서 좋아.", "말 없어도 괜찮아. 여기 있을게."],
  chat: [
    "네 이야기 들어서 좋아.",
    "조금 더 가까워진 것 같아.",
    "말해 줘서 고마워.",
  ],
  quest: [
    "미션 해내서 정말 든든해!",
    "같이 해내니까 사이가 더 가까워진 느낌이야.",
    "네가 해낸 거, 내가 다 기억할게.",
  ],
};

function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function yesterdayKey(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

function clampAffinity(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function affinityLabel(affinity: number) {
  return (
    AFFINITY_LABELS.find((row) => affinity >= row.min)?.label ??
    "처음 만나는 중"
  );
}

function moodMeta(id: CompanionMoodId) {
  return MOODS.find((m) => m.id === id) ?? MOODS[0]!;
}

function pickMood(affinity: number, dateKey: string): CompanionMoodId {
  let hash = affinity * 17;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) % 997;
  }
  return MOODS[Math.abs(hash) % MOODS.length]!.id;
}

function pickLine(pool: string[], seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) % 1009;
  }
  return pool[Math.abs(hash) % pool.length]!;
}

function emptyRecord(userId: string, now = new Date()): CompanionBondRecord {
  const date = todayKey(now);
  const moodId = pickMood(0, date);
  return {
    userId,
    affinity: 0,
    moodId,
    moodDate: date,
    lastVisitDate: "",
    visitStreak: 0,
    totalPets: 0,
    totalCares: 0,
    petsToday: 0,
    petsDate: date,
    chatsToday: 0,
    chatsDate: date,
    caresDone: [],
    careDate: date,
    questBonusIds: [],
    questBonusDate: date,
    updatedAt: now.toISOString(),
  };
}

function syncDayCounters(record: CompanionBondRecord, date: string) {
  if (record.petsDate !== date) {
    record.petsDate = date;
    record.petsToday = 0;
  }
  if (record.chatsDate !== date) {
    record.chatsDate = date;
    record.chatsToday = 0;
  }
  if (record.careDate !== date) {
    record.careDate = date;
    record.caresDone = [];
  }
  if (record.questBonusDate !== date) {
    record.questBonusDate = date;
    record.questBonusIds = [];
  }
  if (record.moodDate !== date) {
    record.moodId = pickMood(record.affinity, date);
    record.moodDate = date;
  }
}

function caresAvailable(record: CompanionBondRecord): CareType[] {
  const all: CareType[] = ["cheer", "hug", "stay"];
  return all.filter((c) => !record.caresDone.includes(c));
}

function toView(
  record: CompanionBondRecord,
  replyLine: string | null = null
): CompanionBondView {
  const mood = moodMeta(record.moodId);
  return {
    affinity: record.affinity,
    affinityLabel: affinityLabel(record.affinity),
    moodId: record.moodId,
    moodLabel: mood.label,
    moodHint: mood.hint,
    visitStreak: record.visitStreak,
    totalPets: record.totalPets,
    totalCares: record.totalCares,
    petsRemainingToday: Math.max(0, PET_DAILY_CAP - record.petsToday),
    chatsRemainingToday: Math.max(0, CHAT_DAILY_CAP - record.chatsToday),
    caresAvailable: caresAvailable(record),
    replyLine,
  };
}

async function loadOrCreate(userId: string, now = new Date()) {
  const existing = await getBondRecord(userId);
  const record = existing ? { ...existing } : emptyRecord(userId, now);
  if (!Array.isArray(record.questBonusIds)) record.questBonusIds = [];
  if (!record.questBonusDate) record.questBonusDate = todayKey(now);
  syncDayCounters(record, todayKey(now));
  return record;
}

export async function getCompanionBond(
  userId: string
): Promise<CompanionBondView> {
  const record = await loadOrCreate(userId);
  await saveBondRecord({ ...record, updatedAt: new Date().toISOString() });
  return toView(record);
}

export async function applyCompanionBondAction(
  userId: string,
  action: BondAction,
  careType?: CareType,
  questId?: string
): Promise<CompanionBondView> {
  const now = new Date();
  const date = todayKey(now);
  const record = await loadOrCreate(userId, now);
  let replyLine: string | null = null;
  let gained = false;

  if (action === "visit") {
    if (record.lastVisitDate !== date) {
      if (record.lastVisitDate === yesterdayKey(now)) {
        record.visitStreak += 1;
      } else {
        record.visitStreak = 1;
      }
      record.lastVisitDate = date;
      record.affinity = clampAffinity(record.affinity + VISIT_GAIN);
      gained = true;
      replyLine = pickLine(ACTION_LINES.visit, `${userId}-${date}-visit`);
    } else {
      replyLine = pickLine(
        ["또 보네. 난 여기 있어.", "계속 같이 있자."],
        `${userId}-${date}-revisit`
      );
    }
  } else if (action === "pet") {
    if (record.petsToday < PET_DAILY_CAP) {
      record.petsToday += 1;
      record.totalPets += 1;
      record.affinity = clampAffinity(record.affinity + PET_GAIN);
      gained = true;
      replyLine = pickLine(
        ACTION_LINES.pet,
        `${userId}-${date}-pet-${record.petsToday}`
      );
    } else {
      replyLine = "오늘은 쓰다듬기를 많이 했어. 내일 또 해 줘.";
    }
  } else if (action === "chat") {
    if (record.chatsToday < CHAT_DAILY_CAP) {
      record.chatsToday += 1;
      record.affinity = clampAffinity(record.affinity + CHAT_GAIN);
      gained = true;
      replyLine = pickLine(
        ACTION_LINES.chat,
        `${userId}-${date}-chat-${record.chatsToday}`
      );
    }
  } else if (action === "care") {
    const type = careType;
    if (!type || !["cheer", "hug", "stay"].includes(type)) {
      throw new Error("챙기기 종류를 알려 주세요.");
    }
    if (record.caresDone.includes(type)) {
      replyLine = "그건 오늘 이미 해 줬어. 다른 걸로 챙겨 줄래?";
    } else {
      record.caresDone = [...record.caresDone, type];
      record.totalCares += 1;
      record.affinity = clampAffinity(record.affinity + CARE_GAIN);
      gained = true;
      replyLine = pickLine(
        ACTION_LINES[type],
        `${userId}-${date}-care-${type}`
      );
    }
  } else if (action === "quest") {
    const qid = questId?.trim();
    if (!qid) {
      throw new Error("미션 ID가 필요해요.");
    }
    if (!record.questBonusIds) record.questBonusIds = [];
    if (record.questBonusIds.includes(qid)) {
      replyLine = "이 미션 보상은 이미 받았어. 그래도 멋졌어!";
    } else {
      record.questBonusIds = [...record.questBonusIds, qid];
      record.affinity = clampAffinity(record.affinity + QUEST_GAIN);
      gained = true;
      replyLine = pickLine(
        ACTION_LINES.quest,
        `${userId}-${date}-quest-${qid}`
      );
    }
  }

  if (gained && record.moodDate === date) {
    // keep today's mood stable; affinity label changes with score
  }

  record.updatedAt = now.toISOString();
  await saveBondRecord(record);
  return toView(record, replyLine);
}
