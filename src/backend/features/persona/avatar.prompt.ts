import type { CharacterProfile, EnergyLevel, InteractionStyle } from "./persona.types";

type AnimalKind =
  | "bunny"
  | "puppy"
  | "kitten"
  | "bear cub"
  | "fox"
  | "owl"
  | "penguin"
  | "hamster";

/** One preschool crayon example per companion animal. */
export const AVATAR_STYLE_REF_BY_ANIMAL: Record<AnimalKind, string> = {
  bunny: "bunny-crayon.png",
  puppy: "puppy-crayon.png",
  kitten: "kitten-crayon.png",
  "bear cub": "bear-crayon.png",
  fox: "fox-crayon.png",
  owl: "owl-crayon.png",
  penguin: "penguin-crayon.png",
  hamster: "hamster-crayon.png",
};

export const AVATAR_STYLE_REF_FILES = [
  "kitten-crayon.png",
  "puppy-crayon.png",
  "bunny-crayon.png",
  "bear-crayon.png",
  "owl-crayon.png",
  "fox-crayon.png",
  "penguin-crayon.png",
  "hamster-crayon.png",
] as const;

/**
 * Pick a cute anthropomorphic animal from survey vibes.
 */
export function pickCompanionAnimal(character: CharacterProfile): AnimalKind {
  const blob = [
    character.disposition,
    character.hobbies,
    character.favoriteHobby,
    character.strengthsWeaknesses,
    character.stressRelief,
    character.mainActivity,
  ]
    .join(" ")
    .toLowerCase();

  if (/혼자|조용|내향|차분|quiet|cat|고양이|kitten/.test(blob)) return "kitten";
  if (/장난|놀|게임|외향|play|puppy|강아지|dog/.test(blob)) return "puppy";
  if (/상상|이야기|책|독서|owl|부엉|story/.test(blob)) return "owl";
  if (/따뜻|다정|챙|고마|bear|곰|포근/.test(blob)) return "bear cub";
  if (/조심|여리|토끼|bunny|rabbit/.test(blob)) return "bunny";
  if (/음악|재치|영리|fox|여우/.test(blob)) return "fox";
  if (/휴식|잠|느긋|penguin|펭귄/.test(blob)) return "penguin";
  if (/작|귀여|hamster|햄스터/.test(blob)) return "hamster";

  const name = character.nickname || "beddy";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % 8;
  const fallback: AnimalKind[] = [
    "bunny",
    "puppy",
    "kitten",
    "bear cub",
    "fox",
    "owl",
    "penguin",
    "hamster",
  ];
  return fallback[hash]!;
}

/**
 * Authentic preschool crayon drawing — match bundled style-reference examples.
 */
export function buildCrayonAvatarPrompt(input: {
  character: CharacterProfile;
  energy?: EnergyLevel;
  interaction?: InteractionStyle;
  currentYear?: number;
}): { prompt: string; negativePrompt: string; animal: AnimalKind } {
  const animal = pickCompanionAnimal(input.character);

  const moodHint =
    input.energy === "low"
      ? "sleepy cozy"
      : input.energy === "high"
        ? "playful cheerful"
        : "warm friendly";

  const traitHint = [input.character.disposition, input.character.favoriteHobby]
    .filter((v) => Boolean(v?.trim()))
    .join(", ")
    .slice(0, 80);

  const promptCore = [
    "A real preschool classroom drawing.",
    `Draw one simple ${animal}.`,
    "The child is drawing from memory.",
    "Created by a real preschool child.",
    "Very simple shapes.",
    "Uneven proportions.",
    "Crooked outlines.",
    "Messy scribbled coloring.",
    "Random child-like mistakes.",
    "The child does not know anatomy.",
    "Do not improve the drawing.",
    "Do not beautify the drawing.",
    "Looks handmade.",
    "Centered.",
    "Pure white background.",
    "Nothing else.",
  ];

  const positive = [
    "A genuine preschool classroom drawing.",
    `Draw ONLY ONE simple ${animal}.`,
    "The child is trying to draw the animal from memory.",
    "Created by a real preschool child.",
    "The child has poor drawing skills.",
    "Very simple circles and ovals.",
    "Simple body.",
    "Large head.",
    "Tiny body.",
    "Short legs.",
    "Simple tail.",
    "Simple black dot eyes.",
    "Tiny nose.",
    "Small crooked smile.",
    "Uneven ears.",
    "Uneven proportions.",
    "Crooked outlines.",
    "Shaky hand-drawn lines.",
    "Messy scribbled coloring.",
    "Random crayon scribbles.",
    "The coloring direction changes randomly.",
    "Some coloring goes outside the outlines.",
    "Some small areas are left uncolored.",
    "Uneven coloring pressure.",
    "Natural child-like mistakes.",
    "The drawing is charming because of its mistakes.",
    "The child does not know anatomy.",
    "The child guesses what the animal looks like.",
    "Do not improve the drawing.",
    "Do not beautify the drawing.",
    "Do not correct mistakes.",
    "Looks like an authentic preschool classroom artwork.",
    "Single character only.",
    "Centered composition.",
    "Pure white background.",
    "Nothing else.",
  ];

  const styleReference = [
    "The uploaded image is a style reference only.",
    "Keep the same:",
    "child-like drawing quality",
    "uneven outlines",
    "messy scribbled coloring",
    "preschool drawing style",
    "simple proportions",
    `Create a completely different ${animal}.`,
    "Do not copy the composition.",
    "Do not copy the pose.",
    "Do not copy the colors.",
    "Do not copy any accessories.",
    "Create an original drawing in the same style.",
  ];

  const prompt = [
    ...promptCore,
    ...positive,
    ...styleReference,
    "Match the crayon texture and child-like mistakes of the matching preschool animal example drawing.",
    `Expression vibe: ${moodHint}.`,
    traitHint ? `Personality vibe: ${traitHint}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const negativePrompt = [
    "professional illustration",
    "children's book",
    "storybook",
    "Pixar",
    "Disney",
    "DreamWorks",
    "anime",
    "manga",
    "concept art",
    "character design",
    "mascot",
    "reference sheet",
    "character sheet",
    "digital painting",
    "3D",
    "CGI",
    "render",
    "realistic",
    "photo",
    "highly detailed",
    "beautiful",
    "perfect",
    "clean lineart",
    "perfect anatomy",
    "symmetrical",
    "detailed fur",
    "realistic fur",
    "realistic whiskers",
    "eyelashes",
    "eye highlights",
    "glossy eyes",
    "collar",
    "ribbon",
    "clothing",
    "accessories",
    "background",
    "grass",
    "sky",
    "floor",
    "shadow",
    "multiple animals",
    "multiple characters",
    "props",
    "text",
    "logo",
    "watermark",
  ].join(", ");

  return { prompt, negativePrompt, animal };
}
