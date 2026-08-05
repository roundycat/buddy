/**
 * AWS-ready service facade.
 *
 * App Router and Route Handlers should call these entry points.
 * Implementations live in `src/backend/features/*` for now (local JSON MVP).
 *
 * TODO [AWS DynamoDB]: swap store implementations behind the same exports
 * TODO [AWS Bedrock]: chat / adventure / story / RAG stay in feature services
 * TODO [AWS S3]: storybook assets / memory media
 * TODO [AWS Polly]: companion voice
 * TODO [AWS OpenSearch]: wish/memory RAG retrieval
 * TODO [AWS EventBridge]: daily adventure refresh / discharge storybook seal
 */

export {
  getPersona,
  generatePersona,
  isPersonaSetupCompleted,
} from "@/backend/features/persona/persona.service";

export { getAdventureQuest } from "@/backend/features/adventure-quest/adventure-quest.service";
export { maybeComposeDayStory } from "@/backend/features/adventure-quest/adventure-story.service";

export {
  getEmotionGarden,
  plantTodayMood,
  sealGardenStorybook,
} from "@/backend/features/emotion-garden/emotion-garden.service";

export {
  getWishTree,
  addWish,
  removeWish,
  formatWishesForPrompt,
} from "@/backend/features/wish-tree/wish-tree.service";

export { getWallet, claimQuestReward } from "@/backend/features/wallet/wallet.service";

export { getMemoryTimeline } from "@/backend/features/memory-timeline/memory-timeline.service";
export { getGrowthStorybook } from "@/backend/features/growth-storybook/growth-storybook.service";
export {
  getHospitalDay,
  getHospitalScheduleMonth,
  listParentSchedule,
  createParentScheduleItem,
  updateParentScheduleItem,
  deleteParentScheduleItem,
  markHospitalItemDone,
} from "@/backend/features/hospital-day/hospital-day.service";
export { getGrowthJournal } from "@/backend/features/growth-journal/growth-journal.service";
export { getMemoryPost } from "@/backend/features/memory-post/memory-post.service";
export { sendMessage } from "@/backend/features/conversation/conversation.service";
export { login } from "@/backend/features/auth/auth.service";

export { getCompanionStatusDashboard } from "@/backend/features/companion-status/companion-status.service";
export {
  getParentHome,
  getParentTimeline,
  askParentReport,
  getParentProfile,
  updateParentProfileSettings,
} from "@/backend/features/parent/parent.service";
export {
  getOrCreateChildInvite,
  linkGuardianWithCode,
  getGuardianLinkStatus,
} from "@/backend/features/guardian-link/guardian-link.service";
