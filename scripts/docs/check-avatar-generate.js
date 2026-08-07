/**
 * Smoke-test Stability text-to-image (same path as avatar.generate).
 */
const fs = require("fs");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");

function loadEnv(path) {
  const env = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

(async () => {
  const env = loadEnv(".env.local");
  const region = env.BEDROCK_IMAGE_REGION || "us-west-2";
  const modelId = env.BEDROCK_IMAGE_MODEL_ID || "stability.stable-image-ultra-v1:1";
  const client = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const started = Date.now();
  try {
    const res = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          prompt:
            "A single cute anthropomorphic bunny mascot drawn with children crayons, solid white background, sticker style",
          negative_prompt: "human, photo, realistic, background objects",
          mode: "text-to-image",
          aspect_ratio: "1:1",
          output_format: "png",
          seed: 42,
        }),
      })
    );
    const json = JSON.parse(Buffer.from(res.body).toString("utf8"));
    const b64 = json.images?.[0] || json.image;
    console.log(
      JSON.stringify({
        ok: true,
        modelId,
        region,
        ms: Date.now() - started,
        hasImage: Boolean(b64),
        bytes: b64 ? Buffer.from(b64, "base64").length : 0,
      })
    );
  } catch (e) {
    console.log(
      JSON.stringify({
        ok: false,
        modelId,
        region,
        ms: Date.now() - started,
        name: e.name,
        message: String(e.message || e).slice(0, 500),
      })
    );
  }
})();
