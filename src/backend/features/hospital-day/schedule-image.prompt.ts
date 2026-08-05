import type { HospitalDayItem } from "./hospital-day.types";

/** Bump when comic prompt structure changes — forces redraw of ready images. */
export const SCHEDULE_IMAGE_PROMPT_VERSION = 2;

const TITLE_PREFIX =
  /^(치료 시간|검사 시간|치료|검사)\s*[·•\-–—]?\s*/;

export function cleanScheduleProcedureName(title: string): string {
  return title.replace(TITLE_PREFIX, "").trim() || title.trim() || "hospital care";
}

type VisualRule = { match: RegExp; details: string };

const VISUAL_RULES: VisualRule[] = [
  {
    match: /채혈|피검사|blood\s*draw|blood\s*test/i,
    details:
      "Show a soft blood-draw scene with a tiny bandage after, never graphic blood. Panel 2: arm resting calmly with a friendly nurse holding a small tube, simplified. Panel 3: metaphor of checking the body's messages like reading gentle weather.",
  },
  {
    match: /주사|접종|vaccine|injection|shot/i,
    details:
      "Show a gentle injection as a tiny quick moment, no needle close-up. Panel 2: child looking away while a kind nurse does a soft arm touch. Panel 3: protective shield or sparkles of care entering the body metaphorically.",
  },
  {
    match: /수액|링거|iv\b|infusion/i,
    details:
      "Show a soft IV drip bag with clear liquid and a calm child resting. Panel 2: tube and bag simplified and cute, not clinical. Panel 3: thirsty body receiving gentle water/energy like rain for a plant.",
  },
  {
    match: /초음파|ultrasound|sono/i,
    details:
      "Show ultrasound gel and a rounded probe on the tummy with a soft screen glow. Panel 2: child lying comfortably, probe like a friendly flashlight. Panel 3: seeing inside gently like a soft window into the body.",
  },
  {
    match: /mri|엠알아이|자기공명/i,
    details:
      "Show a soft tunnel machine that looks cozy, not scary. Panel 2: child lying still on a bed sliding in calmly with headphones. Panel 3: quiet listening to the body like a soft camera taking a careful picture.",
  },
  {
    match: /ct|씨티|전산화단층/i,
    details:
      "Show a doughnut-shaped soft scanner, calm and round. Panel 2: child lying still while the ring gently moves. Panel 3: layered soft slices metaphor helping doctors understand the body map.",
  },
  {
    match: /엑스레이|x-?ray|방사선/i,
    details:
      "Show a soft X-ray camera and a child posing calmly. Panel 2: brief still pose with a friendly tech. Panel 3: gentle skeleton outline like a soft shadow picture, never scary bones.",
  },
  {
    match: /항암|chemotherapy|chemo/i,
    details:
      "Show quiet infusion chair and soft medicine bag, cozy blanket. Panel 2: child resting while medicine drips gently. Panel 3: tiny helpers cleaning up unwelcome cells metaphorically with sparkles, never violent.",
  },
  {
    match: /물리치료|재활|pt\b|physiotherapy/i,
    details:
      "Show gentle stretch or walking practice with a therapist. Panel 2: playful soft exercise tools. Panel 3: body getting stronger like a small sprout growing.",
  },
  {
    match: /처방|약|복약|medicine|pill/i,
    details:
      "Show cute rounded medicine and water cup. Panel 2: child taking medicine calmly with a helper. Panel 3: medicine as tiny helpers balancing the body.",
  },
];

export function buildProcedureVisualDetails(
  title: string,
  type: HospitalDayItem["type"],
  whatText?: string,
  whyText?: string
): string {
  const name = cleanScheduleProcedureName(title);
  const haystack = `${name} ${whatText ?? ""} ${whyText ?? ""}`;
  for (const rule of VISUAL_RULES) {
    if (rule.match.test(haystack)) return rule.details;
  }

  const kind =
    type === "treatment"
      ? "treatment helping the body feel better"
      : "checkup learning how the body is doing";
  const hint = [whatText, whyText]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 160);

  return [
    `Procedure-specific cues for "${name}" (${kind}).`,
    "Keep equipment simplified, recognizable, and not scary.",
    "Panel 2 must clearly show how it is done with posture and setting.",
    "Panel 3 must show a simple kind metaphor for why it helps.",
    hint ? `Child-facing hint to reflect softly: ${hint}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Wordless 4-panel comic prompt for child hospital schedule education.
 */
export function buildScheduleComicPrompt(item: HospitalDayItem): {
  prompt: string;
  negativePrompt: string;
} {
  const procedureName = cleanScheduleProcedureName(item.title);
  const isExam = item.type === "exam";
  const topicNoun = isExam ? "medical checkup / exam" : "medical treatment";
  const topicVerb = isExam ? "checkup" : "treatment";
  const visualDetails = buildProcedureVisualDetails(
    item.title,
    item.type,
    item.whatText,
    item.whyText
  );

  const prompt = `
Create a wordless 4-panel comic illustration for a 10-year-old child that explains a ${topicNoun} in a clear, gentle, child-friendly way.

The topic is: ${procedureName}.

Important goal:
The child should understand what the ${topicVerb} is, how it happens, why it helps, and what happens after it is finished, using pictures only, with no written text at all.

Style:
warm hand-drawn children’s illustration, colored pencil and crayon texture, soft pastel colors, soft ivory paper background, cute rounded characters, gentle facial expressions, slightly uneven hand-drawn outlines, picture-book quality, cozy and emotionally safe mood, adorable hospital education style, polished and visually clear.

Layout:
exactly 4-panel comic layout in a 2x2 grid on one square page, clean composition, rounded panel borders, consistent character design across all 4 panels, simple background details, cute decorative elements such as stars, hearts, clouds, sparkles, and soft doodles around the page.

Main character:
a brave but slightly curious 10-year-old child, shown in a calm and reassured way throughout the 4 panels.
Friendly doctor or nurse characters should appear warm, trustworthy, and kind.
Medical equipment should look simplified, clean, recognizable, and not scary.

Content structure:
Panel 1: show a doctor or nurse gently introducing ${procedureName} to the child. The child understands they are about to receive this ${topicVerb}. The mood is calm and safe.
Panel 2: show clearly how the ${topicVerb} is done. The child is receiving ${procedureName} in a simple, visually understandable way. Show the real posture, equipment, and medical setting in a softened, child-friendly form.
Panel 3: show why the ${topicVerb} helps, using an easy visual metaphor a child can understand. Make the purpose visually obvious. Show it helping the body in a simple, kind, educational way.
Panel 4: show the ${topicVerb} finished successfully. The child looks relieved, proud, and comforted, with praise, rest, or supportive care afterward.

Critical constraints:
No text, no speech bubbles, no captions, no labels, no letters, no numbers.
Do not rely on written explanation.
The story must be understandable through pictures only.
Do not make the ${topicVerb} look frightening.
Do not show gore, blood in a graphic way, severe pain, panic, or distressing realism.
Keep medical details truthful but simplified for a child.
Make the process visually clear, emotionally reassuring, and age-appropriate.

Procedure-specific visual details:
${visualDetails}
`.trim();

  const negativePrompt = [
    "text, speech bubbles, captions, labels, letters, numbers, watermark, logo,",
    "written explanation, Korean text, English text, typography,",
    "horror, gore, graphic blood, severe pain, panic, crying in distress,",
    "needle close-up, scary medical tools, dark shadows, photorealistic,",
    "3d render, adult faces only, crowded chaotic panels, EMR screens, charts",
  ].join(" ");

  return { prompt, negativePrompt };
}
