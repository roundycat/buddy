import type {
  GeneratePersonaResponse,
  GetPersonaResponse,
  Persona,
  PersonaPreferences,
} from "./persona.types";
import {
  buildPersonaFromPreferences,
  getPersonaForUser,
  hasCompletedPersonaSetup,
  saveGeneratedPersona,
} from "./persona.store";
import {
  AVATAR_CHOICE_COUNT,
  generateCrayonAvatar,
} from "./avatar.generate";
import {
  readAvatarImage,
  saveAvatarImage,
  selectAvatarCandidate,
} from "./avatar.store";
import { removeAvatarBackground } from "./avatar.remove-bg";
import { HttpError } from "@/backend/shared/http/route";

export async function getPersona(userId?: string): Promise<GetPersonaResponse> {
  if (!userId) {
    const persona = await getPersonaForUser("anonymous");
    return { persona, setupCompleted: false };
  }

  const setupCompleted = await hasCompletedPersonaSetup(userId);
  const persona = await getPersonaForUser(userId);

  if (setupCompleted) {
    const image = await readAvatarImage(userId);
    if (image) {
      persona.avatarUrl =
        persona.avatarUrl || `/api/persona/avatar?v=${Date.now()}`;
    } else {
      persona.avatarUrl = undefined;
    }
  }

  return { persona, setupCompleted };
}

const CHOICE_VARIANTS = [
  "Same authentic preschool crayon style. Soft smile. No props.",
  "Same authentic preschool crayon style. Friendly wave pose. No props.",
];

/**
 * Generate one crayon candidate (used for parallel client calls under CF timeout).
 */
export async function generateSingleAvatarChoice(
  userId: string,
  persona: Persona,
  preferences: Pick<PersonaPreferences, "energy" | "interaction">,
  index: number,
  stamp = Date.now()
): Promise<{ id: string; url: string; prompt: string }> {
  const character = persona.profile;
  if (!character) {
    throw new HttpError("Beddy 정보가 없어요. 온보딩을 다시 해 주세요.", 400);
  }

  const safeIndex = Math.max(0, Math.min(index, AVATAR_CHOICE_COUNT - 1));
  try {
    const avatar = await generateCrayonAvatar({
      character,
      energy: preferences.energy,
      interaction: preferences.interaction,
      seed: (stamp + safeIndex * 97) % 4294967296,
      promptVariant: CHOICE_VARIANTS[safeIndex] ?? "",
      removeBackground: false,
    });
    const id = String(safeIndex);
    await saveAvatarImage(userId, avatar.bytes, avatar.contentType, id);
    return {
      id,
      url: `/api/persona/avatar?c=${id}&v=${stamp}`,
      prompt: avatar.prompt,
    };
  } catch (error) {
    // The cause goes to the log only — the child sees a plain retry note.
    console.error(`[persona] avatar candidate ${safeIndex} failed:`, error);
    throw new HttpError("그림을 그리지 못했어요. 잠시 뒤에 다시 해 주세요.", 502);
  }
}

async function generateAvatarChoices(
  userId: string,
  persona: Persona,
  preferences: Pick<PersonaPreferences, "energy" | "interaction">
) {
  const stamp = Date.now();
  const character = persona.profile;
  if (!character) {
    throw new HttpError("Beddy 정보가 없어요. 온보딩을 다시 해 주세요.", 400);
  }

  // Parallel text-to-image only (no remove-bg) to stay under proxy timeouts.
  const jobs = Array.from({ length: AVATAR_CHOICE_COUNT }, (_, index) =>
    generateSingleAvatarChoice(userId, persona, preferences, index, stamp)
  );

  const avatarChoices: Array<{ id: string; url: string }> = [];
  const results = await Promise.allSettled(jobs);
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      avatarChoices.push({ id: result.value.id, url: result.value.url });
      if (!persona.avatarPrompt) persona.avatarPrompt = result.value.prompt;
    } else {
      const reason = result.reason;
      errors.push(
        reason instanceof Error ? reason.message : String(reason ?? "failed")
      );
      console.error("[persona] avatar candidate failed:", reason);
    }
  }

  if (avatarChoices.length === 0) {
    console.error("[persona] every avatar candidate failed:", errors[0]);
    throw new HttpError("그림을 그리지 못했어요. 잠시 뒤에 다시 해 주세요.", 502);
  }

  await selectAvatarCandidate(userId, avatarChoices[0]!.id);
  persona.avatarUrl = `/api/persona/avatar?v=${stamp}`;
  return { avatarChoices, stamp };
}

export async function generatePersona(
  userId: string,
  preferences: PersonaPreferences
): Promise<GeneratePersonaResponse> {
  if (!preferences.self?.nickname?.trim()) {
    throw new Error("이름을 입력해 주세요.");
  }
  if (!preferences.mode) {
    throw new Error("페르소나 만들기 방식을 선택해 주세요.");
  }
  if (!preferences.character?.nickname?.trim()) {
    throw new Error("Beddy의 이름을 입력해 주세요.");
  }
  if (!preferences.energy) {
    throw new Error("에너지 레벨을 선택해 주세요.");
  }
  if (!preferences.interaction) {
    throw new Error("상호작용 방식을 선택해 주세요.");
  }

  const persona = buildPersonaFromPreferences(userId, preferences);
  // Save persona first; crayons are drawn in a separate parallel step (timeout-safe).
  await saveGeneratedPersona(userId, persona);

  return { persona, setupCompleted: true, avatarChoices: [] };
}

export async function regeneratePersonaAvatars(userId: string): Promise<{
  avatarChoices: Array<{ id: string; url: string }>;
}> {
  const persona = await getPersonaForUser(userId);
  if (!persona.setupCompleted || !persona.profile) {
    throw new HttpError("먼저 Beddy를 만들어 주세요.", 400);
  }

  const { avatarChoices } = await generateAvatarChoices(userId, persona, {
    energy: persona.energy ?? "medium",
    interaction: persona.interaction ?? "listen",
  });
  await saveGeneratedPersona(userId, persona);
  return { avatarChoices };
}

/**
 * One-slot regenerate for parallel client requests (avoids CF 30s wall).
 */
export async function regeneratePersonaAvatarSlot(
  userId: string,
  slot: number,
  stamp?: number
): Promise<{ choice: { id: string; url: string }; stamp: number }> {
  const persona = await getPersonaForUser(userId);
  if (!persona.setupCompleted || !persona.profile) {
    throw new HttpError("먼저 Beddy를 만들어 주세요.", 400);
  }

  const usedStamp = stamp ?? Date.now();
  const choice = await generateSingleAvatarChoice(
    userId,
    persona,
    {
      energy: persona.energy ?? "medium",
      interaction: persona.interaction ?? "listen",
    },
    slot,
    usedStamp
  );

  if (!persona.avatarPrompt) persona.avatarPrompt = choice.prompt;
  // Keep first finished slot as temporary active until user picks.
  if (slot === 0) {
    await selectAvatarCandidate(userId, choice.id);
    persona.avatarUrl = `/api/persona/avatar?v=${usedStamp}`;
  }
  await saveGeneratedPersona(userId, persona);

  return {
    choice: { id: choice.id, url: choice.url },
    stamp: usedStamp,
  };
}

export async function choosePersonaAvatar(
  userId: string,
  candidateId: string
): Promise<{ avatarUrl: string }> {
  const source = await readAvatarImage(userId, candidateId);
  if (!source) {
    throw new Error("선택한 그림을 찾을 수 없어요. 다시 만들어 주세요.");
  }

  // Apply background removal once at confirm time (not during generation).
  let bytes = source.bytes;
  try {
    bytes = await removeAvatarBackground(source.bytes);
  } catch (error) {
    console.warn("[persona] select remove-bg skipped:", error);
  }

  await saveAvatarImage(userId, bytes, "image/png", candidateId);
  await saveAvatarImage(userId, bytes, "image/png");

  const persona = await getPersonaForUser(userId);
  const avatarUrl = `/api/persona/avatar?v=${Date.now()}`;
  persona.avatarUrl = avatarUrl;
  await saveGeneratedPersona(userId, persona);
  return { avatarUrl };
}

export async function isPersonaSetupCompleted(userId: string): Promise<boolean> {
  return hasCompletedPersonaSetup(userId);
}
