/**
 * Guardian dashboard DTOs — mirrors backend CompanionStatusDashboard.
 * Keep UI imports stable while hydration moves server-side.
 */

export type {
  CompanionConditionLevel as GuardianConditionLevel,
  CompanionConditionSignal as GuardianConditionSignal,
  CompanionNeedRecommendation as GuardianNeedRecommendation,
  CompanionStatusDashboard as GuardianDashboardData,
} from "@/backend/features/companion-status/companion-status.types";
