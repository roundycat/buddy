import "server-only";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "@/backend/shared/config/env";
import type { CharacterProfile, EnergyLevel, InteractionStyle } from "./persona.types";
import { buildCrayonAvatarPrompt } from "./avatar.prompt";
import { loadAvatarStyleRefForAnimal, loadAvatarStyleRefBase64 } from "./avatar.style-refs";
import { wipeSolidBackdrop } from "./avatar.matte";
import { removeAvatarBackground } from "./avatar.remove-bg";

export type GeneratedAvatar = {
  bytes: Buffer;
  contentType: "image/jpeg" | "image/png";
  model: string;
  prompt: string;
};

function createClient(region: string) {
  const { accessKeyId, secretAccessKey, sessionToken } = env.bedrock;
  return new BedrockRuntimeClient({
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

/** Prefer fast Core; fall back to Ultra if Core unavailable. */
function imageModelCandidates(): string[] {
  const preferred = env.bedrock.imageModelId;
  const fallbacks = [
    preferred,
    "stability.stable-image-core-v1:1",
    "stability.stable-image-ultra-v1:1",
  ];
  return Array.from(new Set(fallbacks.filter(Boolean)));
}

function styleGuideModelCandidates(): string[] {
  return Array.from(
    new Set([
      "us.stability.stable-image-style-guide-v1:0",
      "stability.stable-image-style-guide-v1:0",
    ])
  );
}

function normalizeSeed(seed?: number): number | undefined {
  if (typeof seed !== "number" || !Number.isFinite(seed)) return undefined;
  return Math.abs(Math.trunc(seed)) % 4294967296;
}

function parseImagePayload(body: Uint8Array): Buffer {
  const json = JSON.parse(Buffer.from(body).toString("utf8")) as {
    images?: string[];
    image?: string;
  };
  const b64 = json.images?.[0] || json.image;
  if (!b64) {
    throw new Error("Bedrock image response had no image payload.");
  }
  return Buffer.from(b64, "base64");
}

/**
 * Style Guide: generate from prompt while matching a preschool example drawing.
 */
async function invokeStabilityStyleGuide(input: {
  prompt: string;
  negativePrompt: string;
  styleImageBase64: string;
  seed?: number;
  fidelity?: number;
}): Promise<{ bytes: Buffer; model: string }> {
  const region = env.bedrock.imageRegion;
  const client = createClient(region);
  const seed = normalizeSeed(input.seed);
  let lastError: unknown;

  for (const modelId of styleGuideModelCandidates()) {
    try {
      const response = await client.send(
        new InvokeModelCommand({
          modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify({
            prompt: input.prompt,
            negative_prompt: input.negativePrompt,
            image: input.styleImageBase64,
            fidelity: input.fidelity ?? 0.72,
            aspect_ratio: "1:1",
            output_format: "png",
            ...(typeof seed === "number" ? { seed } : {}),
          }),
        })
      );

      return {
        bytes: parseImagePayload(response.body),
        model: modelId,
      };
    } catch (error) {
      lastError = error;
      console.warn(
        `[avatar] style-guide failed (${modelId}):`,
        error instanceof Error ? error.message : error
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Bedrock style-guide generation failed.");
}

/**
 * Ultra image-to-image fallback — keep crayon style, rewrite subject via prompt.
 * Higher strength = more prompt, less composition copy.
 */
async function invokeStabilityImageToImage(input: {
  prompt: string;
  negativePrompt: string;
  imageBase64: string;
  seed?: number;
  strength?: number;
}): Promise<{ bytes: Buffer; model: string }> {
  const region = env.bedrock.imageRegion;
  const client = createClient(region);
  const seed = normalizeSeed(input.seed);
  const models = [
    "stability.stable-image-ultra-v1:1",
    "stability.stable-image-ultra-v1:0",
    ...imageModelCandidates(),
  ];
  let lastError: unknown;

  for (const modelId of Array.from(new Set(models))) {
    try {
      const response = await client.send(
        new InvokeModelCommand({
          modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify({
            prompt: input.prompt,
            negative_prompt: input.negativePrompt,
            mode: "image-to-image",
            image: input.imageBase64,
            strength: input.strength ?? 0.78,
            aspect_ratio: "1:1",
            output_format: "png",
            ...(typeof seed === "number" ? { seed } : {}),
          }),
        })
      );

      return {
        bytes: parseImagePayload(response.body),
        model: modelId,
      };
    } catch (error) {
      lastError = error;
      console.warn(
        `[avatar] image-to-image failed (${modelId}):`,
        error instanceof Error ? error.message : error
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Bedrock image-to-image generation failed.");
}

async function invokeStabilityTextToImage(input: {
  prompt: string;
  negativePrompt: string;
  seed?: number;
  aspectRatio?: "1:1" | "16:9" | "3:2";
}): Promise<{ bytes: Buffer; model: string }> {
  const region = env.bedrock.imageRegion;
  const client = createClient(region);
  const seed = normalizeSeed(input.seed);
  let lastError: unknown;

  for (const modelId of imageModelCandidates()) {
    try {
      const response = await client.send(
        new InvokeModelCommand({
          modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify({
            prompt: input.prompt,
            negative_prompt: input.negativePrompt,
            mode: "text-to-image",
            aspect_ratio: input.aspectRatio ?? "1:1",
            output_format: "png",
            ...(typeof seed === "number" ? { seed } : {}),
          }),
        })
      );

      return {
        bytes: parseImagePayload(response.body),
        model: modelId,
      };
    } catch (error) {
      lastError = error;
      console.warn(
        `[avatar] text-to-image failed (${modelId}):`,
        error instanceof Error ? error.message : error
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Bedrock image generation failed.");
}

/**
 * Generic soft PNG illustration (shared by avatar / schedule).
 */
export async function generateStabilityPng(input: {
  prompt: string;
  negativePrompt: string;
  seed?: number;
  aspectRatio?: "1:1" | "16:9" | "3:2";
}): Promise<{ bytes: Buffer; model: string }> {
  return invokeStabilityTextToImage(input);
}

function shouldRemoveBackground() {
  const flag = process.env.AVATAR_REMOVE_BG?.trim().toLowerCase();
  // Default OFF during generation (timeout-safe). Set AVATAR_REMOVE_BG=true to enable.
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  return false;
}

/**
 * Generate a crayon-style anthropomorphic animal avatar.
 * Uses bundled preschool example drawings as style references when available.
 */
export async function generateCrayonAvatar(input: {
  character: CharacterProfile;
  energy?: EnergyLevel;
  interaction?: InteractionStyle;
  seed?: number;
  promptVariant?: string;
  /** Which style-ref example to learn from when animal match is unavailable. */
  styleRefIndex?: number;
  removeBackground?: boolean;
}): Promise<GeneratedAvatar> {
  const built = buildCrayonAvatarPrompt(input);
  const prompt = input.promptVariant
    ? `${built.prompt} ${input.promptVariant}`
    : built.prompt;

  const styleImage =
    loadAvatarStyleRefForAnimal(built.animal) ??
    loadAvatarStyleRefBase64(
      typeof input.styleRefIndex === "number"
        ? input.styleRefIndex
        : typeof input.seed === "number"
          ? input.seed
          : 0
    );

  let generated: { bytes: Buffer; model: string } | null = null;

  if (styleImage) {
    try {
      generated = await invokeStabilityStyleGuide({
        prompt,
        negativePrompt: built.negativePrompt,
        styleImageBase64: styleImage,
        seed: input.seed,
        fidelity: 0.72,
      });
    } catch (error) {
      console.warn(
        "[avatar] style-guide unavailable, trying image-to-image:",
        error instanceof Error ? error.message : error
      );
      try {
        generated = await invokeStabilityImageToImage({
          prompt,
          negativePrompt: built.negativePrompt,
          imageBase64: styleImage,
          seed: input.seed,
          strength: 0.78,
        });
      } catch (i2iError) {
        console.warn(
          "[avatar] image-to-image unavailable, falling back to text-to-image:",
          i2iError instanceof Error ? i2iError.message : i2iError
        );
      }
    }
  }

  if (!generated) {
    generated = await invokeStabilityTextToImage({
      prompt,
      negativePrompt: built.negativePrompt,
      seed: input.seed,
    });
  }

  let bytes = generated.bytes;
  const doRemove =
    input.removeBackground === true ||
    (input.removeBackground !== false && shouldRemoveBackground());

  if (doRemove) {
    try {
      bytes = await removeAvatarBackground(generated.bytes);
    } catch (error) {
      console.warn("[avatar] background removal skipped:", error);
    }
  } else {
    // Fast local punch-out of flat white/cream plate (no Bedrock) so only the character remains.
    try {
      bytes = await wipeSolidBackdrop(generated.bytes);
    } catch (error) {
      console.warn("[avatar] local matte skipped:", error);
    }
  }

  return {
    bytes,
    contentType: "image/png",
    model: generated.model,
    prompt,
  };
}

export const AVATAR_CHOICE_COUNT = 2;
