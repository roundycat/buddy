import type { HospitalDayItem } from "./hospital-day.types";

/** Bump when comic prompt structure changes — forces redraw of ready images. */
export const SCHEDULE_IMAGE_PROMPT_VERSION = 3;

const TITLE_PREFIX =
  /^(치료 시간|검사 시간|치료|검사)\s*[·•\-–—]?\s*/;

export function cleanScheduleProcedureName(title: string): string {
  return title.replace(TITLE_PREFIX, "").trim() || title.trim() || "hospital care";
}

/** Panel 2 shows the procedure itself, panel 3 shows why it helps. */
type VisualRule = { match: RegExp; during: string; benefit: string };

/**
 * Positive phrasing only. Stability's safety filter matches clinical keywords
 * even inside negations, so every prohibition belongs in the negative prompt.
 */
const VISUAL_RULES: VisualRule[] = [
  {
    match: /채혈|피검사|blood\s*draw|blood\s*test/i,
    during:
      "the child sits in a cozy chair with one arm resting on a soft cushion while the nurse gently fills a tiny sample tube",
    benefit:
      "a cheerful cartoon droplet floats into a friendly rounded laboratory machine glowing with happy stars",
  },
  {
    match: /주사|접종|vaccine|injection|shot/i,
    during:
      "the nurse gives a quick soft touch on the child's upper arm while the child looks at a cheerful wall poster",
    benefit:
      "a sparkling protective shield of stars settles gently around the smiling child",
  },
  {
    match: /수액|링거|iv\b|infusion/i,
    during:
      "the child rests under a warm blanket beside a cute rounded drip bag of clear liquid on a friendly stand",
    benefit:
      "a happy potted plant drinks gentle rain and stretches its leaves upward",
  },
  {
    match: /초음파|ultrasound|sono/i,
    during:
      "the child lies comfortably while the nurse glides a small rounded probe over the tummy like a friendly flashlight",
    benefit:
      "a soft glowing round window shows cheerful sparkles inside a warm cartoon body outline",
  },
  {
    match: /mri|엠알아이|자기공명/i,
    during:
      "the child lies calmly with colorful headphones on a padded bed sliding into a cozy rounded tunnel machine",
    benefit:
      "a gentle cartoon camera takes a quiet careful picture surrounded by soft musical notes",
  },
  {
    match: /ct|씨티|전산화단층/i,
    during:
      "the child rests still on a padded bed while a doughnut shaped scanner ring turns slowly and softly glows",
    benefit:
      "soft layered paper slices stack together into a friendly colorful map",
  },
  {
    match: /엑스레이|x-?ray|방사선/i,
    during:
      "the child stands very still in a bright room in front of a large rounded camera machine while the nurse smiles nearby",
    benefit:
      "a soft glowing shadow picture of a friendly silhouette appears on a warm screen",
  },
  {
    match: /항암|chemotherapy|chemo/i,
    during:
      "the child relaxes in a comfy reclining chair under a cozy blanket beside a soft medicine bag dripping slowly",
    benefit:
      "tiny cheerful cartoon helpers with brooms tidy up a sparkling clean room",
  },
  {
    match: /골수|bone\s*marrow/i,
    during:
      "the child sits up on a padded bed hugging a soft teddy bear while the nurse kneels beside with simplified rounded equipment",
    benefit:
      "a cozy little cartoon workshop inside a heart shape where cheerful helpers are busy making sparkles",
  },
  {
    match: /물리치료|재활|pt\b|physiotherapy/i,
    during:
      "the child practices a gentle stretch on a colorful mat with a cheerful therapist and soft playful exercise tools",
    benefit:
      "a small green sprout grows taller and stronger in warm sunshine",
  },
  {
    match: /처방|약|복약|medicine|pill/i,
    during:
      "the child calmly takes a cute rounded medicine with a cup of water while the nurse smiles beside them",
    benefit:
      "tiny cheerful cartoon helpers balance a wobbly seesaw until it sits perfectly level",
  },
];

const PANEL_GREETING =
  "a smiling nurse in soft teal scrubs warmly greets a calm ten-year-old child in a bright sunny hospital room";

const PANEL_FINISH =
  "the child smiles proudly holding a shiny star sticker while the nurse gives a cheerful thumbs up";

function resolveMiddlePanels(item: HospitalDayItem): [string, string] {
  const haystack = `${cleanScheduleProcedureName(item.title)} ${
    item.whatText ?? ""
  } ${item.whyText ?? ""}`;

  for (const rule of VISUAL_RULES) {
    if (rule.match.test(haystack)) return [rule.during, rule.benefit];
  }

  return item.type === "treatment"
    ? [
        "the child sits calmly on a padded bed while the nurse helps with simplified rounded equipment",
        "a small sprout in a cheerful pot grows taller surrounded by warm sparkles",
      ]
    : [
        "the child sits still and cooperative while the nurse checks carefully with a small rounded instrument",
        "a friendly clipboard covered in happy checkmarks and stars floats above a cheerful cartoon sun",
      ];
}

const STYLE =
  "children's storybook illustration, crayon and colored pencil texture, soft muted pastel palette, gentle hand-drawn outlines, warm ivory paper, cute rounded characters with kind happy faces";

/**
 * Stability follows a 2x2 layout only when the grid is stated up front and each
 * quadrant is named. Style stays at the end so it does not crowd out the panels.
 */
function composePrompt(panels: [string, string, string, string]): string {
  return `
Four panel comic strip on one square page, 2x2 grid of four equal square panels separated by clean white gutters.

Top-left panel: ${panels[0]}.
Top-right panel: ${panels[1]}.
Bottom-left panel: ${panels[2]}.
Bottom-right panel: ${panels[3]}.

Each panel is a complete scene filling its frame. The same school-aged child, about ten years old with realistic child proportions, appears in all four panels together with the same nurse.
Style: ${STYLE}.
`.trim();
}

const NEGATIVE_PROMPT = [
  "text, letters, numbers, words, captions, speech bubbles, typography, watermark, signature, logo,",
  "empty panel, blank space, unfinished, cropped,",
  "toddler, baby, infant, chibi, oversized head,",
  "horror, gore, blood, wounds, injury, pain, distress, panic, crying, fear,",
  "needle close-up, sharp instruments, surgical scene, dark shadows, gloomy lighting,",
  "photorealistic, 3d render, monitor screens, medical charts",
].join(" ");

/**
 * Wordless 4-panel comic explaining one hospital schedule item to a child.
 */
export function buildScheduleComicPrompt(item: HospitalDayItem): {
  prompt: string;
  negativePrompt: string;
} {
  const [during, benefit] = resolveMiddlePanels(item);
  return {
    prompt: composePrompt([PANEL_GREETING, during, benefit, PANEL_FINISH]),
    negativePrompt: NEGATIVE_PROMPT,
  };
}

/**
 * Generic reassurance comic with no procedure wording. Stability's filter is
 * borderline on clinical scenes and rejects the same prompt intermittently, so
 * this is retried when the detailed prompt comes back blocked.
 */
export function buildScheduleComicFallbackPrompt(): {
  prompt: string;
  negativePrompt: string;
} {
  return {
    prompt: composePrompt([
      PANEL_GREETING,
      "the child sits comfortably on a padded bed swinging their legs while the nurse kneels down to chat kindly",
      "a warm cartoon heart surrounded by floating stars, clouds and tiny flowers",
      PANEL_FINISH,
    ]),
    negativePrompt: NEGATIVE_PROMPT,
  };
}
