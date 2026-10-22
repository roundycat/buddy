import { getSessionUser } from "@/backend/shared/http/auth";
import { getPersona } from "@/backend/features/persona/persona.service";
import { getHospitalDay } from "@/backend/features/hospital-day/hospital-day.service";
import { getMemoryTimeline } from "@/backend/features/memory-timeline/memory-timeline.service";
import { getGrowthJournal } from "@/backend/features/growth-journal/growth-journal.service";
import { getTimeline } from "@/backend/features/timeline/timeline.service";
import { getAdventureQuest } from "@/backend/features/adventure-quest/adventure-quest.service";
import { getEmotionGarden } from "@/backend/features/emotion-garden/emotion-garden.service";
import { getMemoryPost } from "@/backend/features/memory-post/memory-post.service";
import { getWallet } from "@/backend/features/wallet/wallet.service";
import { getGrowthStorybook } from "@/backend/features/growth-storybook/growth-storybook.service";
import { getWishTree } from "@/backend/features/wish-tree/wish-tree.service";
import { getPictureDiary } from "@/backend/features/picture-diary/picture-diary.service";
import { getChildSharingView } from "@/backend/features/sharing/sharing.service";
import { withDefaultShareChoices } from "@/backend/features/sharing/sharing.types";
import { isChildConsentPending } from "@/backend/features/consent/consent.guard";

/**
 * App-layer loaders — Server Components only.
 * Prefer these over HTTP self-fetch (avoids missing Cookie / webpack HMR issues).
 */

async function currentUserId() {
  const user = await getSessionUser();
  return user?.id;
}

export async function loadPersona() {
  const userId = await currentUserId();
  return getPersona(userId);
}

export async function loadTimeline() {
  const userId = await currentUserId();
  return getTimeline(userId);
}

export async function loadHospitalDay() {
  const userId = await currentUserId();
  return getHospitalDay(userId);
}

export async function loadMemoryTimeline() {
  const userId = await currentUserId();
  return getMemoryTimeline(userId);
}

export async function loadGrowthJournal() {
  const userId = await currentUserId();
  return getGrowthJournal(userId);
}

export async function loadAdventureQuest() {
  const userId = await currentUserId();
  return getAdventureQuest(userId);
}

export async function loadEmotionGarden() {
  const userId = await currentUserId();
  return getEmotionGarden(userId);
}

export async function loadMemoryPost() {
  const userId = await currentUserId();
  return getMemoryPost(userId);
}

export async function loadWallet() {
  const userId = await currentUserId();
  if (!userId) {
    return {
      balance: 0,
      currencyLabel: "별조각",
      currencyHint: "",
      ledger: [],
    };
  }
  return getWallet(userId);
}

export async function loadGrowthStorybook() {
  const userId = await currentUserId();
  return getGrowthStorybook(userId);
}

export async function loadWishTree() {
  const userId = await currentUserId();
  return getWishTree(userId);
}

export async function loadPictureDiary() {
  const userId = await currentUserId();
  return getPictureDiary(userId);
}

export async function loadChildSharing() {
  const userId = await currentUserId();
  if (!userId) {
    return { choices: withDefaultShareChoices(null), updatedAt: null };
  }
  return getChildSharingView(userId);
}

/**
 * True while the signed-in child (under 14) waits for legal-guardian consent.
 * Pages that would run AI on load show the consent screen instead.
 */
export async function loadChildConsentPending(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user || user.role === "guardian") return false;
  return isChildConsentPending(user);
}
