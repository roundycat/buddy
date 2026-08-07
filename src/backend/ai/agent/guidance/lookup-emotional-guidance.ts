import "server-only";
import cards from "./emotional-guidance.cards.json";

/**
 * Mission Agent tool — curated emotional-support guidance cards.
 * Not guardian RAG: public practice principles only (no child transcripts).
 * Called only when the plan sets needsGuidanceDocs.
 */

export type GuidanceTag =
  | "isolation"
  | "treatment_anxiety"
  | "self_expression"
  | "play"
  | "low_energy"
  | "hospital_routine"
  | "family_bond";

export interface EmotionalGuidanceCard {
  id: string;
  tags: GuidanceTag[];
  title: string;
  principle: string;
  missionHints: string[];
  avoid: string[];
  sources: string[];
}

const ALL_CARDS = cards as EmotionalGuidanceCard[];

const VALID_TAGS = new Set<GuidanceTag>([
  "isolation",
  "treatment_anxiety",
  "self_expression",
  "play",
  "low_energy",
  "hospital_routine",
  "family_bond",
]);

export function lookupEmotionalGuidance(input: {
  tags?: string[];
  /** Max cards to return (default 3) */
  limit?: number;
}): EmotionalGuidanceCard[] {
  const limit = Math.min(5, Math.max(1, input.limit ?? 3));
  const tags = (input.tags ?? [])
    .map((t) => t.trim())
    .filter((t): t is GuidanceTag => VALID_TAGS.has(t as GuidanceTag));

  if (!tags.length) {
    return ALL_CARDS.filter((c) => c.tags.includes("hospital_routine")).slice(
      0,
      limit
    );
  }

  const scored = ALL_CARDS.map((card) => {
    const score = card.tags.reduce(
      (n, tag) => n + (tags.includes(tag) ? 1 : 0),
      0
    );
    return { card, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));

  return scored.slice(0, limit).map((x) => x.card);
}

export function formatGuidanceForPrompt(
  guidanceCards: EmotionalGuidanceCard[]
): string {
  if (!guidanceCards.length) return "(가이드 없음)";
  return guidanceCards
    .map(
      (c, i) =>
        `${i + 1}. [${c.id}] ${c.title}
원칙: ${c.principle}
미션 힌트: ${c.missionHints.join(" / ")}
피할 것: ${c.avoid.join(" / ")}`
    )
    .join("\n\n");
}

/** Deterministic tags when the plan omits them or LLM failed. */
export function inferGuidanceTags(input: {
  scene: string;
  focusSignals?: string[];
  hasTreatment?: boolean;
  energy?: string;
}): GuidanceTag[] {
  const tags = new Set<GuidanceTag>();
  const blob = `${input.scene} ${(input.focusSignals ?? []).join(" ")}`;

  if (input.scene === "treatment" || input.hasTreatment || /치료|검사/.test(blob)) {
    tags.add("treatment_anxiety");
    tags.add("play");
  }
  if (input.scene === "low_energy" || input.energy === "low" || /에너지|피곤/.test(blob)) {
    tags.add("low_energy");
  }
  if (/고립|외로|친구|관계/.test(blob)) tags.add("isolation");
  if (/표현|기분|감정/.test(blob)) tags.add("self_expression");
  if (input.scene === "rainy" || input.scene === "sunny") {
    tags.add("hospital_routine");
    tags.add("play");
  }
  if (!tags.size) {
    tags.add("hospital_routine");
    tags.add("self_expression");
  }
  return Array.from(tags).slice(0, 4);
}
