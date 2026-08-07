import "server-only";
import { generateStabilityPng } from "@/backend/features/persona/avatar.generate";
import { pickCompanionAnimal } from "@/backend/features/persona/avatar.prompt";
import { getPersonaForUser } from "@/backend/features/persona/persona.store";
import { createBlobStore } from "@/backend/shared/persist/blob-store";
import {
  getSealedDischargeTale,
  saveSealedDischargeTale,
} from "./growth-storybook.store";
import type { StorybookPage } from "./growth-storybook.types";

const blobs = createBlobStore({
  prefix: "storybooks",
  localSubdir: "storybooks",
  feature: "storybook-illustration",
});

const generating = new Set<string>();

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function locatePage(
  tale: NonNullable<Awaited<ReturnType<typeof getSealedDischargeTale>>>,
  pageId: string
) {
  if (tale.opening.id === pageId) return tale.opening;
  if (tale.epilogue.id === pageId) return tale.epilogue;
  if (tale.goodbye?.id === pageId) return tale.goodbye;
  return tale.pages.find((page) => page.id === pageId) ?? null;
}

function replacePage(
  tale: NonNullable<Awaited<ReturnType<typeof getSealedDischargeTale>>>,
  next: StorybookPage
) {
  if (tale.opening.id === next.id) tale.opening = next;
  else if (tale.epilogue.id === next.id) tale.epilogue = next;
  else if (tale.goodbye?.id === next.id) tale.goodbye = next;
  else tale.pages = tale.pages.map((page) => (page.id === next.id ? next : page));
}

function imageUrl(pageId: string) {
  return `/api/storybook/page/${encodeURIComponent(pageId)}/illustration?v=${Date.now()}`;
}

const MOTIF_SCENE: Record<string, string> = {
  castle:
    "a tall storybook castle of soft white stone with rounded towers, fluttering pennants, an arched wooden gate and a winding path of warm stepping stones",
  forest:
    "a friendly enchanted forest of tall rounded trees, dappled sunbeams falling through layered leaves, mossy stones and a small winding trail",
  garden:
    "a blooming cottage garden with tall flowers of many colors, butterflies, watering can and low stone border",
  tree: "one enormous wish tree with a thick curving trunk, a huge round canopy and many small ribbon-tied wish leaves glowing among the branches",
  window:
    "a cozy arched window seen from inside, wooden frame, a potted plant on the sill and a gentle sunny landscape outside",
  sunrise:
    "a wide sunrise over rolling hills with a tall open stone archway and a path of light leading through it",
  home: "a warm little cottage at golden hour with a tiled roof, curling chimney smoke, a wooden fence and flowers by the door",
  stars:
    "a peaceful night meadow under a huge starry sky with a big soft moon, drifting fireflies and gentle silhouetted hills",
  friends:
    "a grassy hilltop picnic at dusk with a striped blanket, a small lantern, floating fireflies and a wide starry sky",
};

const PALETTE_MOOD: Record<string, string> = {
  sage: "soft sage green, cream and honey light",
  rose: "dusty rose, peach and warm ivory",
  sky: "gentle sky blue, soft teal and warm sand",
  amber: "golden amber, wheat and soft caramel",
  violet: "muted lavender, dusk violet and warm cream",
};

/**
 * Build a real picture-book plate: painterly, layered depth, and deliberately
 * empty lower foreground so the child's own crayon friend can stand there.
 */
function buildScenePrompt(input: {
  page: StorybookPage;
  companionAnimal: string;
}) {
  const motif = input.page.illustration?.motif ?? "stars";
  const palette = input.page.illustration?.palette ?? "sage";
  const scene = MOTIF_SCENE[motif] ?? MOTIF_SCENE.stars!;
  const mood = PALETTE_MOOD[palette] ?? PALETTE_MOOD.sage!;

  return [
    "Award-winning classic children's picture-book illustration, full-page plate.",
    "Traditional watercolor and gouache on warm textured watercolor paper, visible paper grain, soft pigment bleeds, delicate colored-pencil linework on top.",
    `Scene: ${scene}.`,
    `Story moment: ${input.page.illustration?.alt || input.page.title}.`,
    `Color mood: ${mood}, warm golden rim light, gentle atmospheric haze.`,
    "Rich painterly detail with three clear depth layers: distant background, illustrated midground subject, and a simple open foreground.",
    `A single small friendly ${input.companionAnimal} character with rounded simple shapes may appear in the midground, looking welcoming.`,
    "Leave the lower third of the frame calm and uncluttered with soft ground, so a character can stand there.",
    "Wide 3:2 landscape composition, generous negative space, tender hopeful mood, storybook whimsy.",
    "No words, no letters, no numbers, no captions, no borders, no panels, no signature.",
    "Never depict a realistic hospital, medical equipment, needles, injury, blood, illness, fear or any clinical procedure.",
  ].join(" ");
}

async function companionAnimalFor(userId: string) {
  try {
    const persona = await getPersonaForUser(userId);
    const character = persona.profile ?? persona.self;
    if (!character) return "animal friend";
    return pickCompanionAnimal(character);
  } catch {
    return "animal friend";
  }
}

export async function readStorybookIllustration(
  userId: string,
  pageId: string
) {
  const tale = await getSealedDischargeTale(userId);
  if (!tale || !locatePage(tale, pageId)) return null;
  const bytes = await blobs.read(userId, safeId(pageId));
  return bytes ? { bytes, contentType: "image/png" } : null;
}

/** Lazily generate one page so opening a book never triggers 12 costly calls. */
export async function ensureStorybookIllustration(
  userId: string,
  pageId: string
) {
  const tale = await getSealedDischargeTale(userId);
  if (!tale) return null;
  const page = locatePage(tale, pageId);
  if (!page) return null;

  if (page.illustration?.imageStatus === "ready") {
    const existing = await blobs.read(userId, safeId(pageId));
    if (existing) return { page: { ...page, illustration: { ...page.illustration, imageUrl: imageUrl(pageId) } } };
  }
  if (generating.has(`${userId}:${pageId}`)) {
    return { page };
  }

  const key = `${userId}:${pageId}`;
  generating.add(key);
  const pending: StorybookPage = {
    ...page,
    illustration: {
      ...(page.illustration ?? {
        motif: "stars",
        palette: "sage",
        alt: "따뜻한 그림책 장면",
      }),
      imageStatus: "pending",
    },
  };
  replacePage(tale, pending);
  await saveSealedDischargeTale(tale);

  try {
    const prompt = buildScenePrompt({
      page,
      companionAnimal: await companionAnimalFor(userId),
    });
    const generated = await generateStabilityPng({
      prompt,
      negativePrompt:
        "text, letters, words, captions, numbers, watermark, signature, frame, border, panels, speech bubble, photorealism, 3d render, cgi, anime, hospital room, medical equipment, needle, blood, injury, horror, scary, dark, gloomy, harsh contrast, cluttered, busy composition, deformed hands, extra limbs",
      seed:
        Math.abs(
          Array.from(`${userId}:${pageId}`).reduce(
            (sum, char) => sum + char.charCodeAt(0),
            0
          )
        ) % 4294967296,
      aspectRatio: "3:2",
    });
    await blobs.save(userId, safeId(pageId), generated.bytes, "image/png");
    const ready: StorybookPage = {
      ...pending,
      illustration: {
        ...pending.illustration!,
        imageStatus: "ready",
        imageUrl: imageUrl(pageId),
      },
    };
    replacePage(tale, ready);
    await saveSealedDischargeTale(tale);
    return { page: ready };
  } catch (error) {
    console.warn("[storybook-illustration] generation failed:", error);
    const failed: StorybookPage = {
      ...pending,
      illustration: { ...pending.illustration!, imageStatus: "failed" },
    };
    replacePage(tale, failed);
    await saveSealedDischargeTale(tale);
    return { page: failed };
  } finally {
    generating.delete(key);
  }
}

export async function clearStorybookIllustrations(userId: string) {
  const tale = await getSealedDischargeTale(userId);
  if (!tale) return;
  const pages = [
    tale.opening,
    ...tale.pages,
    tale.epilogue,
    ...(tale.goodbye ? [tale.goodbye] : []),
  ];
  await Promise.all(
    pages.map((page) => blobs.remove(userId, safeId(page.id)))
  );
}
