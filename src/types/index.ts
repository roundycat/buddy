/**
 * Shared domain types surface for App Router / frontend DTOs.
 * Prefer importing feature-specific types from here when crossing layers.
 *
 * TODO [AWS]: keep these contracts stable when swapping DynamoDB/Bedrock backends.
 */

export type {
  AuthUser,
  LoginRequest,
  LoginResult,
} from "@/backend/features/auth/auth.types";

export type {
  Persona,
  PersonaPreferences,
  SelfProfile,
  CharacterProfile,
  EnergyLevel,
  InteractionStyle,
} from "@/backend/features/persona/persona.types";

export type {
  AdventureQuestResponse,
  AdventureQuestItem,
  AdventureDayStory,
} from "@/backend/features/adventure-quest/adventure-quest.types";

export type {
  EmotionGardenResponse,
  GardenFlower,
  MoodId,
} from "@/backend/features/emotion-garden/emotion-garden.types";

export type {
  WishTreeResponse,
  WishItem,
  WishHorizon,
} from "@/backend/features/wish-tree/wish-tree.types";

export type {
  WalletResponse,
  WalletLedgerEntry,
} from "@/backend/features/wallet/wallet.types";

export type {
  MemoryTimelineResponse,
  MemoryEvent,
} from "@/backend/features/memory-timeline/memory-timeline.types";

export type { GrowthStorybookResponse } from "@/backend/features/growth-storybook/growth-storybook.types";
