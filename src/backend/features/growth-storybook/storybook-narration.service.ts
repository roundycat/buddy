import "server-only";
import {
  PollyClient,
  SynthesizeSpeechCommand,
  type Engine,
  type VoiceId,
} from "@aws-sdk/client-polly";
import { env } from "@/backend/shared/config/env";

function createPolly() {
  const { accessKeyId, secretAccessKey, sessionToken, region } = env.bedrock;
  return new PollyClient({
    region,
    ...(accessKeyId && secretAccessKey
      ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
            ...(sessionToken ? { sessionToken } : {}),
          },
        }
      : {}),
  });
}

type VoiceTry = {
  VoiceId: VoiceId;
  Engine: Engine;
  useSsml: boolean;
};

/**
 * 소연이(Seoyeon) 우선 — 엄마가 읽어주는 톤.
 * Generative → Neural, Jihye는 최후 폴백.
 */
const VOICE_TRIES: VoiceTry[] = [
  { VoiceId: "Seoyeon", Engine: "generative", useSsml: true },
  { VoiceId: "Seoyeon", Engine: "generative", useSsml: false },
  { VoiceId: "Seoyeon", Engine: "neural", useSsml: true },
  { VoiceId: "Jihye", Engine: "neural", useSsml: true },
];

function escapeSsml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 숨 고르기 · 부드러운 문장 간격 */
function softenForBedtime(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/([.!?…])\s*/g, "$1 ")
    .replace(/,\s*/g, ", ")
    .replace(/\s+([.!?…])/g, "$1")
    .trim();
}

/**
 * 엄마가 옆에 앉아 읽어주는 느낌:
 * 더 천천히, 조금 낮은 톤, 문장마다 여유 있는 쉼.
 */
function toMomReadingSsml(text: string) {
  const parts = softenForBedtime(text)
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const body = parts
    .map((p, i) => {
      const pause =
        i < parts.length - 1
          ? p.length > 36
            ? '<break time="720ms"/>'
            : '<break time="560ms"/>'
          : '<break time="380ms"/>';
      return `${escapeSsml(p)}${pause}`;
    })
    .join(" ");

  return (
    `<speak>` +
    `<prosody rate="78%" pitch="-8%" volume="soft">` +
    `<amazon:effect name="drc">${body}</amazon:effect>` +
    `</prosody>` +
    `</speak>`
  );
}

/** Generative용 가벼운 SSML (태그 최소화) */
function toGenerativeMomSsml(text: string) {
  const parts = softenForBedtime(text)
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const body = parts
    .map(
      (p, i) =>
        `${escapeSsml(p)}${i < parts.length - 1 ? '<break time="620ms"/>' : ""}`
    )
    .join(" ");
  return `<speak><prosody rate="80%" pitch="-5%">${body}</prosody></speak>`;
}

async function synthesizeOnce(
  client: PollyClient,
  text: string,
  tryVoice: VoiceTry
) {
  const soft = softenForBedtime(text);
  const ssml =
    tryVoice.Engine === "generative"
      ? toGenerativeMomSsml(soft)
      : toMomReadingSsml(soft);

  const response = await client.send(
    new SynthesizeSpeechCommand({
      Text: tryVoice.useSsml ? ssml : soft,
      TextType: tryVoice.useSsml ? "ssml" : "text",
      OutputFormat: "mp3",
      VoiceId: tryVoice.VoiceId,
      Engine: tryVoice.Engine,
      LanguageCode: "ko-KR",
      SampleRate: tryVoice.Engine === "generative" ? "24000" : "22050",
    })
  );
  if (!response.AudioStream) throw new Error("empty audio");
  return Buffer.from(await response.AudioStream.transformToByteArray());
}

/** 소연이 — 엄마가 읽어주는 이야기책 낭독 */
export async function synthesizeStorybookNarration(text: string) {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 2800);
  if (!clean) throw new Error("읽을 이야기가 없어요.");

  const client = createPolly();
  let lastError: unknown;

  for (const voice of VOICE_TRIES) {
    try {
      return await synthesizeOnce(client, clean, voice);
    } catch (error) {
      lastError = error;
      console.warn(
        `[storybook-narration] ${voice.Engine}/${voice.VoiceId}` +
          `${voice.useSsml ? "+ssml" : ""} failed, trying next`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.error("[storybook-narration] all voices failed:", lastError);
  throw new Error("Beddy 목소리를 만들지 못했어요.");
}
