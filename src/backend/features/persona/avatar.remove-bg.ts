import "server-only";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "@/backend/shared/config/env";
import { wipeSolidBackdrop } from "./avatar.matte";

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

function parseImagePayload(json: {
  images?: string[];
  image?: string;
}): Buffer | null {
  const b64 = json.images?.[0] || json.image;
  if (!b64) return null;
  return Buffer.from(b64, "base64");
}

async function removeBackgroundWithBedrock(
  pngBytes: Buffer
): Promise<Buffer | null> {
  const preferredModel = env.bedrock.imageRemoveBgModelId;
  const attempts: Array<{ region: string; modelId: string }> = [
    { region: env.bedrock.imageRegion, modelId: preferredModel },
    {
      region: "us-west-2",
      modelId: "us.stability.stable-image-remove-background-v1:0",
    },
    {
      region: "us-east-1",
      modelId: "us.stability.stable-image-remove-background-v1:0",
    },
  ];

  const seen = new Set<string>();
  for (const attempt of attempts) {
    const key = `${attempt.region}::${attempt.modelId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      const client = createClient(attempt.region);
      const response = await client.send(
        new InvokeModelCommand({
          modelId: attempt.modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify({
            image: pngBytes.toString("base64"),
            output_format: "png",
          }),
        })
      );
      const json = JSON.parse(Buffer.from(response.body).toString("utf8")) as {
        images?: string[];
        image?: string;
      };
      const out = parseImagePayload(json);
      if (out) {
        console.info(
          `[avatar] remove-bg ok via ${attempt.region}/${attempt.modelId}`
        );
        return out;
      }
    } catch (error) {
      console.warn(
        `[avatar] remove-bg failed ${attempt.region}/${attempt.modelId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return null;
}

/**
 * Prefer Bedrock remove-bg, then local matte. Never throws.
 */
export async function removeAvatarBackground(
  pngBytes: Buffer
): Promise<Buffer> {
  try {
    const bedrock = await removeBackgroundWithBedrock(pngBytes);
    let bytes = bedrock ?? pngBytes;
    if (!bedrock) {
      console.warn("[avatar] Bedrock remove-bg unavailable; local matte only");
    }

    try {
      bytes = await wipeSolidBackdrop(bytes);
    } catch (error) {
      console.warn("[avatar] matte wipe skipped:", error);
    }

    return bytes;
  } catch (error) {
    console.warn("[avatar] removeAvatarBackground failed open:", error);
    return pngBytes;
  }
}
