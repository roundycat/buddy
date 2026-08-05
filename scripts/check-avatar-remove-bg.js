/**
 * Smoke-test avatar background removal (Bedrock + local matte).
 * Usage: node --env-file=.env.local scripts/check-avatar-remove-bg.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");

function loadEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

async function makeSample() {
  // Red circle on cream paper — mimics crayon plate
  const size = 256;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#F5EFE6"/>
    <circle cx="128" cy="128" r="70" fill="#D96B5C"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function wipeSolidBackdrop(pngBytes) {
  const { data, info } = await sharp(pngBytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const sample = (x, y) => {
    const o = (y * width + x) * channels;
    return { r: data[o], g: data[o + 1], b: data[o + 2], a: data[o + 3] };
  };
  const corners = [
    sample(2, 2),
    sample(width - 3, 2),
    sample(2, height - 3),
    sample(width - 3, height - 3),
  ];
  const backdrop = {
    r: Math.round(corners.reduce((s, c) => s + c.r, 0) / 4),
    g: Math.round(corners.reduce((s, c) => s + c.g, 0) / 4),
    b: Math.round(corners.reduce((s, c) => s + c.b, 0) / 4),
  };
  const dist = (p) =>
    Math.hypot(p.r - backdrop.r, p.g - backdrop.g, p.b - backdrop.b);
  const visited = new Uint8Array(width * height);
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    const p = sample(x, y);
    if (dist(p) > 55) return;
    visited[i] = 1;
    q.push(i);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  let cleared = 0;
  while (q.length) {
    const i = q.pop();
    const x = i % width;
    const y = (i / width) | 0;
    data[i * 4 + 3] = 0;
    cleared++;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  const out = await sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  return { out, cleared };
}

(async () => {
  const env = loadEnv(".env.local");
  const sample = await makeSample();
  const outDir = path.join(".data", "avatars");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "_sample-in.png"), sample);

  const region = env.BEDROCK_IMAGE_REGION || "us-west-2";
  const modelId =
    env.BEDROCK_IMAGE_REMOVE_BG_MODEL_ID ||
    "us.stability.stable-image-remove-background-v1:0";
  const client = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  let bedrockOk = false;
  let bedrockErr = null;
  try {
    const res = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          image: sample.toString("base64"),
          output_format: "png",
        }),
      })
    );
    const json = JSON.parse(Buffer.from(res.body).toString("utf8"));
    const b64 = json.images?.[0] || json.image;
    if (!b64) throw new Error("no image in response");
    const bytes = Buffer.from(b64, "base64");
    fs.writeFileSync(path.join(outDir, "_sample-bedrock.png"), bytes);
    bedrockOk = true;
  } catch (e) {
    bedrockErr = String(e.message || e).slice(0, 300);
  }

  const matte = await wipeSolidBackdrop(sample);
  fs.writeFileSync(path.join(outDir, "_sample-matte.png"), matte.out);

  console.log(
    JSON.stringify(
      {
        bedrockOk,
        bedrockErr,
        region,
        modelId,
        matteClearedPixels: matte.cleared,
        files: [
          ".data/avatars/_sample-in.png",
          bedrockOk ? ".data/avatars/_sample-bedrock.png" : null,
          ".data/avatars/_sample-matte.png",
        ].filter(Boolean),
      },
      null,
      2
    )
  );
})();
