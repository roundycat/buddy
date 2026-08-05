/**
 * Companion status dashboard — non-clinical “life signals” for guardians.
 * Hydrated from the linked child's garden / chat memory / wishes / adventure.
 *
 * TODO [AWS Bedrock RAG]: retrieve similar-day care notes for recommendations
 * TODO [AWS DynamoDB]: GuardianChildLinkTable + CompanionStatusDaily snapshot
 * TODO [AWS EventBridge]: refresh status after garden plant / chat turn / wish
 */

export type CompanionConditionLevel = "low" | "medium" | "high";

export interface CompanionConditionSignal {
  id: string;
  label: string;
  level: CompanionConditionLevel;
  hint: string;
  emoji: string;
}

export interface CompanionNeedRecommendation {
  id: string;
  title: string;
  reason: string;
  actionHint: string;
  /** Provenance tags — later map to RAG chunk ids */
  sources: string[];
  priority: "now" | "today" | "soft";
}

export interface CompanionStatusDashboard {
  /** False until guardian redeems a child invite code */
  linked: boolean;
  childUserId: string | null;
  childName: string;
  dayCount: number;
  updatedLabel: string;
  companionNote: string;
  condition: {
    overallLabel: string;
    overallHint: string;
    signals: CompanionConditionSignal[];
  };
  recommendations: CompanionNeedRecommendation[];
  /** mock = fallback copy only; live = composed from child account data */
  ragStatus: "mock" | "live";
  sourceSummary: {
    hasTodayMood: boolean;
    chatTurns: number;
    wishCount: number;
    adventureScene: string | null;
    emotionalThemes: string[];
  };
}
