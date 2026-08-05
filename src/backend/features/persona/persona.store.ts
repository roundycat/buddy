import type {
  CharacterProfile,
  EnergyLevel,
  InteractionStyle,
  Persona,
  PersonaBuildMode,
  PersonaPreferences,
  SelfProfile,
} from "./persona.types";
import { createMapStore } from "@/backend/shared/persist/map-store";

/**
 * Secret-friend personas by userId.
 * TODO [AWS DynamoDB]: PersonaProfileTable — use PERSISTENCE=dynamodb
 */

const store = createMapStore<Persona>("personas.json");


const ENERGY_COPY: Record<
  EnergyLevel,
  { greeting: string; prompt: string; mood: string; voice: string }
> = {
  low: {
    mood: "고요하고 느린",
    voice: "말수가 적고 호흡이 느림. 짧은 문장, 부담 없는 침묵을 허용",
    greeting: "오늘은 천천히 와도 괜찮아. 나는 여기 앉아 있을게.",
    prompt: "힘 빼도 돼. 지금 마음만 조금만 말해줄래?",
  },
  medium: {
    mood: "차분한",
    voice: "중간 호흡. 공감 후 한 문장 정도 이어감",
    greeting: "다시 왔네. 숨 고를 때까지 같이 있을게.",
    prompt: "오늘 하루, 나랑 조금만 이야기해줄래?",
  },
  high: {
    mood: "또렷하고 밝은",
    voice: "또렷하되 과하게 들뜨지 않음. 리듬감 있는 짧은 문장",
    greeting: "오, 기운이 느껴져. 그 흐름 존중하면서 같이 있어 볼까.",
    prompt: "지금 마음에 남는 거 하나만 꺼내볼래?",
  },
};

const INTERACTION_COPY: Record<
  InteractionStyle,
  { tone: string; habit: string }
> = {
  listen: {
    tone: "경청형 Beddy",
    habit: "먼저 듣고 감정을 비춤. 해결책보다 곁에 머무름",
  },
  chat: {
    tone: "수다형 Beddy",
    habit: "가벼운 질문과 이야기로 대화를 이어 감. 심심할 때 먼저 말을 걸어도 됨",
  },
  motivate: {
    tone: "응원형 Beddy",
    habit: "공감 뒤 아주 작은 다음 걸음만 부드럽게 제안",
  },
  play: {
    tone: "놀이형 Beddy",
    habit: "짧은 퀴즈·상상·가벼운 장난으로 분위기를 부드럽게 바꿈. 과하게 들뜨지 않음",
  },
  quiet: {
    tone: "조용한 동반형 Beddy",
    habit: "말이 적어도 괜찮음. 짧은 안부와 침묵을 존중하며 옆에 있음",
  },
  story: {
    tone: "이야기형 Beddy",
    habit: "짧은 이야기나 상상 장면으로 기분을 부드럽게 바꿔 줌",
  },
};

function normalizeSelf(self: SelfProfile): SelfProfile {
  return {
    nickname: self.nickname.trim(),
    ageOrBirthYear: self.ageOrBirthYear.trim(),
    region: self.region.trim(),
    disposition: self.disposition.trim(),
    mbti: self.mbti.trim().toUpperCase(),
    strengthsWeaknesses: self.strengthsWeaknesses.trim(),
    stressRelief: self.stressRelief.trim(),
    hobbies: self.hobbies.trim(),
    favoriteHobby: self.favoriteHobby.trim(),
    mainActivity: self.mainActivity.trim(),
    favoriteFood: self.favoriteFood.trim(),
  };
}

function normalizeCharacter(character: CharacterProfile): CharacterProfile {
  return {
    nickname: character.nickname.trim(),
    ageOrBirthYear: character.ageOrBirthYear.trim(),
    region: character.region.trim(),
    disposition: character.disposition.trim(),
    mbti: character.mbti.trim().toUpperCase(),
    strengthsWeaknesses: character.strengthsWeaknesses.trim(),
    stressRelief: character.stressRelief.trim(),
    hobbies: character.hobbies.trim(),
    favoriteHobby: character.favoriteHobby.trim(),
    mainActivity: character.mainActivity.trim(),
    favoriteFood: character.favoriteFood.trim(),
  };
}

/** Resolve character personality from mode (mirror copies self). */
export function resolveCharacterFromPreferences(
  preferences: PersonaPreferences
): CharacterProfile {
  const self = normalizeSelf(preferences.self);
  const base = normalizeCharacter(preferences.character);

  if (preferences.mode === "mirror") {
    return {
      ...base,
      disposition: self.disposition || base.disposition,
      mbti: self.mbti || base.mbti,
      strengthsWeaknesses: self.strengthsWeaknesses || base.strengthsWeaknesses,
      stressRelief: self.stressRelief || base.stressRelief,
      hobbies: self.hobbies || base.hobbies,
      favoriteHobby: self.favoriteHobby || base.favoriteHobby,
      mainActivity: self.mainActivity || base.mainActivity,
      favoriteFood: self.favoriteFood || base.favoriteFood,
    };
  }

  return base;
}

function buildCharacterSheet(
  profile: CharacterProfile,
  energy: (typeof ENERGY_COPY)[EnergyLevel],
  interaction: (typeof INTERACTION_COPY)[InteractionStyle],
  mode: PersonaBuildMode
): string {
  const hobbies =
    [profile.favoriteHobby, profile.hobbies].filter(Boolean).join(" · ") ||
    "아직 구체적 취미 없음";

  return [
    `이름: ${profile.nickname || "Beddy"}`,
    "역할: 병원 생활부터 퇴원까지 함께하는 Beddy",
    mode === "mirror"
      ? "생성 방식: 사용자와 같은 성격 미러링"
      : "생성 방식: 사용자가 따로 설정한 캐릭터",
    profile.disposition && `성격/성향: ${profile.disposition}`,
    profile.mbti &&
      `MBTI 말투·사고 감각: ${profile.mbti} — 이 유형의 리듬을 체화`,
    profile.strengthsWeaknesses && `장단점: ${profile.strengthsWeaknesses}`,
    `취미·관심사(정말 좋아하는 것): ${hobbies}`,
    profile.stressRelief && `힘들 때 쓰는 방식: ${profile.stressRelief}`,
    profile.favoriteFood && `취향/음식: ${profile.favoriteFood}`,
    profile.mainActivity && `일상 리듬: ${profile.mainActivity}`,
    profile.region && `배경/지역 감각: ${profile.region}`,
    profile.ageOrBirthYear && `나이감(출생연도): ${profile.ageOrBirthYear}`,
    `에너지 보이스: ${energy.mood} — ${energy.voice}`,
    `상호작용 습관: ${interaction.tone} — ${interaction.habit}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRoleLabel(profile: CharacterProfile, mode: PersonaBuildMode): string {
  const bits: string[] = ["Beddy"];
  if (mode === "mirror") bits.push("나와 닮은");
  if (profile.mbti) bits.push(profile.mbti);
  if (profile.favoriteHobby) {
    const first = profile.favoriteHobby.split(",")[0]?.trim();
    if (first) bits.push(`${first} 좋아함`);
  }
  return bits.join(" · ");
}

function buildCompanionMessage(
  profile: CharacterProfile,
  interaction: (typeof INTERACTION_COPY)[InteractionStyle],
  mode: PersonaBuildMode
): string {
  const hobby = profile.favoriteHobby || profile.hobbies;
  const parts = [
    mode === "mirror"
      ? "나는 너와 비슷한 결의 Beddy야."
      : "나는 네가 골라 준 성격의 Beddy야.",
    `말투는 ${interaction.tone} 쪽. ${interaction.habit}.`,
  ];
  if (profile.disposition) {
    parts.push(`성격은 ${profile.disposition} 쪽에 가깝고.`);
  }
  if (hobby) {
    parts.push(`평소엔 ‘${hobby}’ 이야기도 좋아해.`);
  }
  if (profile.mbti) {
    parts.push(`${profile.mbti} 느낌으로 말할게.`);
  }
  return parts.join(" ");
}

export function buildPersonaFromPreferences(
  userId: string,
  preferences: PersonaPreferences
): Persona {
  const mode = preferences.mode === "custom" ? "custom" : "mirror";
  const self = normalizeSelf(preferences.self);
  const profile = resolveCharacterFromPreferences({ ...preferences, mode });
  const friendName = profile.nickname || "Beddy";
  const energy = ENERGY_COPY[preferences.energy];
  const interaction = INTERACTION_COPY[preferences.interaction];
  const characterSheet = buildCharacterSheet(
    profile,
    energy,
    interaction,
    mode
  );

  const toneParts = [
    interaction.tone,
    energy.mood,
    profile.mbti && `${profile.mbti} 감각`,
    profile.disposition,
  ].filter(Boolean);

  return {
    id: `persona-${userId}`,
    name: friendName,
    role: buildRoleLabel(profile, mode),
    callName: "너",
    energy: preferences.energy,
    interaction: preferences.interaction,
    buildMode: mode,
    self,
    profile,
    characterSheet,
    tone: toneParts.join(", "),
    greeting: energy.greeting,
    companionMessage: buildCompanionMessage(profile, interaction, mode),
    prompt: energy.prompt,
    dayCount: 1,
    setupCompleted: true,
  };
}

export function getDefaultPersona(): Persona {
  return {
    id: "persona-default",
    name: "Beddy",
    role: "Beddy",
    greeting: "다시 왔네. 숨 고를 때까지 같이 있을게.",
    tone: "차분하고, 단단하며, 존중하는",
    companionMessage:
      "나는 퇴원까지 곁에 있을 Beddy야. 천천히, 한 걸음씩 같이 가볼까.",
    characterSheet:
      "이름: Beddy\n역할: 퇴원까지 함께하는 Beddy\n성격: 차분하고 존중하는",
    prompt: "오늘 하루, 나랑 조금만 이야기해줄래?",
    callName: "너",
    dayCount: 1,
    setupCompleted: false,
  };
}

export async function hasCompletedPersonaSetup(
  userId: string
): Promise<boolean> {
  const persona = await store.get(userId);
  return Boolean(persona?.setupCompleted && persona.profile);
}

export async function getPersonaForUser(userId: string): Promise<Persona> {
  return (await store.get(userId)) ?? getDefaultPersona();
}

export async function saveGeneratedPersona(
  userId: string,
  persona: Persona
): Promise<Persona> {
  return store.set(userId, persona);
}

export async function clearPersonaForUser(userId: string) {
  await store.delete(userId);
}

export function formatSelfForPrompt(self?: SelfProfile): string {
  if (!self) return "아직 상대(사용자) 정보가 없습니다.";
  const lines = [
    self.nickname && `- 이름/호칭: ${self.nickname}`,
    self.ageOrBirthYear && `- 출생연도/나이감: ${self.ageOrBirthYear}`,
    self.region && `- 지역: ${self.region}`,
    self.disposition && `- 성향: ${self.disposition}`,
    self.mbti && `- MBTI: ${self.mbti}`,
    self.strengthsWeaknesses && `- 장단점: ${self.strengthsWeaknesses}`,
    self.stressRelief && `- 스트레스 해소: ${self.stressRelief}`,
    self.hobbies && `- 취미/관심사: ${self.hobbies}`,
    self.favoriteHobby && `- 요즘 좋아하는 취미: ${self.favoriteHobby}`,
    self.mainActivity && `- 주로 하는 일: ${self.mainActivity}`,
    self.favoriteFood && `- 좋아하는 음식/취향: ${self.favoriteFood}`,
  ].filter(Boolean);
  return lines.length
    ? lines.join("\n")
    : "아직 상대(사용자) 정보가 없습니다.";
}

/** @deprecated */
export function formatProfileForPrompt(profile?: CharacterProfile): string {
  return formatCompanionCharacterForPrompt(undefined, profile);
}

export function formatCompanionCharacterForPrompt(
  persona?: Persona,
  profileFallback?: CharacterProfile
): string {
  if (persona?.characterSheet?.trim()) {
    return persona.characterSheet.trim();
  }

  const profile = persona?.profile ?? profileFallback;
  if (!profile) return "아직 Beddy 캐릭터가 설계되지 않았습니다.";

  return buildCharacterSheet(
    profile,
    ENERGY_COPY[persona?.energy ?? "medium"],
    INTERACTION_COPY[persona?.interaction ?? "listen"],
    persona?.buildMode ?? "custom"
  );
}

export { PERSONA_READY_COOKIE } from "./persona.constants";
