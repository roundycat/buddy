/**
 * Share policy — decides what may cross from the child to a guardian.
 *
 * Pure: no server-only import, no I/O. Rules are evaluated top to bottom:
 *   1. crisis urgent | elevated → "minimal"   (only that help is needed, never content)
 *   2. crisis protect           → "protect_route" (never notify the guardian automatically)
 *   3. persistent distress      → "ask_child" (child decides first)
 *   4. care action              → "share"     (that schedule / help request only)
 *   5. child choice             → "share" | "private"
 *   6. category default         → see DEFAULT_SHARE_CHOICES
 *   7. otherwise                → "private"
 */
import {
  DEFAULT_SHARE_CHOICES,
  SHARE_CATEGORIES,
  type GuardianVisibility,
  type GuardianVisibilityMap,
  type ShareCategory,
  type ShareChoice,
  type ShareChoices,
} from "./sharing.types";

export type CrisisLevel = "none" | "watch" | "elevated" | "urgent" | "protect";

/** Child categories plus signals that are never chosen by a toggle. */
export type ShareKind =
  | ShareCategory
  | "safety"
  | "schedule"
  | "help_request"
  | "concern";

export type ShareDecision =
  | "share"
  | "minimal"
  | "ask_child"
  | "private"
  | "protect_route";

export type ShareReason =
  | "crisis_minimal"
  | "crisis_protect"
  | "persistent_distress"
  | "care_action"
  | "child_choice"
  | "category_default"
  | "no_basis";

export interface SharePolicyInput {
  kind: ShareKind;
  crisisLevel?: CrisisLevel;
  childChoice?: ShareChoice;
  /** A schedule or help request the guardian must see to give care. */
  careAction?: boolean;
  /** Distress that keeps coming back — ask the child before telling anyone. */
  persistentDistress?: boolean;
}

export interface SharePolicyResult {
  decision: ShareDecision;
  reason: ShareReason;
}

function categoryDefault(kind: ShareKind): ShareChoice | null {
  return (SHARE_CATEGORIES as readonly string[]).includes(kind)
    ? DEFAULT_SHARE_CHOICES[kind as ShareCategory]
    : null;
}

export function decideShare(input: SharePolicyInput): SharePolicyResult {
  if (input.crisisLevel === "urgent" || input.crisisLevel === "elevated") {
    return { decision: "minimal", reason: "crisis_minimal" };
  }
  if (input.crisisLevel === "protect") {
    return { decision: "protect_route", reason: "crisis_protect" };
  }
  if (input.persistentDistress) {
    return { decision: "ask_child", reason: "persistent_distress" };
  }
  if (input.careAction) {
    return { decision: "share", reason: "care_action" };
  }
  if (input.childChoice === "share" || input.childChoice === "private") {
    return { decision: input.childChoice, reason: "child_choice" };
  }
  const fallback = categoryDefault(input.kind);
  if (fallback) {
    return { decision: fallback, reason: "category_default" };
  }
  return { decision: "private", reason: "no_basis" };
}

/**
 * A category is shown to a guardian only when the policy says "share"
 * for the child's choice AND the guardian's own view toggle is on.
 */
export function resolveCategoryVisibility(
  category: ShareCategory,
  childChoice: ShareChoice | undefined,
  guardianToggleOn: boolean
): GuardianVisibility {
  const { decision } = decideShare({ kind: category, childChoice });
  if (decision !== "share") return "child_private";
  return guardianToggleOn ? "shown" : "guardian_off";
}

export function resolveGuardianVisibility(
  childChoices: Partial<ShareChoices>,
  guardianToggles: Record<ShareCategory, boolean>
): GuardianVisibilityMap {
  const out = {} as GuardianVisibilityMap;
  for (const category of SHARE_CATEGORIES) {
    out[category] = resolveCategoryVisibility(
      category,
      childChoices[category],
      guardianToggles[category]
    );
  }
  return out;
}

/** Stable key for caches built from a visibility map (e.g. prepared summaries). */
export function guardianVisibilityKey(map: GuardianVisibilityMap): string {
  return SHARE_CATEGORIES.map((c) => `${c}:${map[c]}`).join("|");
}
