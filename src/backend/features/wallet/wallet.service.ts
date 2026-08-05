import {
  appendLedgerEntry,
  getWalletAccount,
  hasLedgerRef,
} from "./wallet.store";
import type { WalletResponse } from "./wallet.types";
import { getAdventurePack } from "@/backend/features/adventure-quest/adventure-quest.store";
import { maybeComposeDayStory } from "@/backend/features/adventure-quest/adventure-story.service";
import { isQuestReadyToClaim, normalizeQuestKind } from "@/backend/features/adventure-quest/adventure-quest.rules";
import type { AdventureDayStory } from "@/backend/features/adventure-quest/adventure-quest.types";
import { todayKey } from "@/backend/shared/time/date";
import { applyCompanionBondAction } from "@/backend/features/companion-bond/bond.service";

export const WALLET_CURRENCY_LABEL = "별조각";
export const WALLET_CURRENCY_HINT =
  "모험·미션을 완료하면 받는 보상이에요. 나중에 꾸미기나 작은 선물에 쓸 수 있어요.";
/** Companion affinity gained when claiming a quest reward. */
export const QUEST_XP_REWARD = 5;

export async function getWallet(userId: string): Promise<WalletResponse> {
  const account = await getWalletAccount(userId);
  return {
    balance: account.balance,
    currencyLabel: WALLET_CURRENCY_LABEL,
    currencyHint: WALLET_CURRENCY_HINT,
    ledger: account.ledger,
  };
}

export async function claimQuestReward(
  userId: string,
  questId: string
): Promise<
  WalletResponse & {
    awarded: number;
    xpAwarded: number;
    alreadyClaimed: boolean;
    dayStory: AdventureDayStory | null;
    storyJustCreated: boolean;
  }
> {
  const pack = await getAdventurePack(userId, todayKey());
  const quest = pack?.quests.find((q) => q.id === questId);
  if (!quest) {
    throw new Error("오늘의 모험에서만 보상을 받을 수 있어요.");
  }

  if (await hasLedgerRef(userId, questId)) {
    const wallet = await getWallet(userId);
    const dayStory = pack?.dayStory ?? (await maybeComposeDayStory(userId));
    return {
      ...wallet,
      awarded: 0,
      xpAwarded: 0,
      alreadyClaimed: true,
      dayStory,
      storyJustCreated: false,
    };
  }

  const kind = normalizeQuestKind(
    "kind" in quest ? quest.kind : undefined,
    quest.title,
    quest.hint
  );
  if (
    !isQuestReadyToClaim({
      kind,
      progress: quest.progress,
    })
  ) {
    throw new Error("미션을 먼저 마친 뒤 별조각을 받을 수 있어요.");
  }

  await appendLedgerEntry(userId, {
    amount: quest.points,
    reason: `모험 · ${quest.title}`,
    source: "quest",
    refId: questId,
  });

  let xpAwarded = 0;
  try {
    const bond = await applyCompanionBondAction(
      userId,
      "quest",
      undefined,
      questId
    );
    // Newly granted if reply is not the "already received" line
    if (
      bond.replyLine &&
      !bond.replyLine.includes("이미 받았어")
    ) {
      xpAwarded = QUEST_XP_REWARD;
    }
  } catch (error) {
    console.warn("[wallet] quest xp grant failed", error);
  }

  const refreshed = await getAdventurePack(userId, todayKey());
  const hadStory = Boolean(refreshed?.dayStory);
  const dayStory = await maybeComposeDayStory(userId);
  const wallet = await getWallet(userId);

  return {
    ...wallet,
    awarded: quest.points,
    xpAwarded,
    alreadyClaimed: false,
    dayStory,
    storyJustCreated: Boolean(dayStory) && !hadStory,
  };
}

export async function isQuestClaimed(userId: string, questId: string) {
  return hasLedgerRef(userId, questId);
}
