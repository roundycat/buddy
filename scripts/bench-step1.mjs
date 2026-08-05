/**
 * STEP 1 latency notes — run: node --env-file=.env.local scripts/bench-step1.mjs
 * Measures Bedrock first-token (chat Haiku vs legacy Opus) when credentials exist.
 */
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

const region = process.env.AWS_REGION || "us-east-1";
const chatModel =
  process.env.BEDROCK_MODEL_ID_CHAT ||
  "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const legacyModel =
  process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-opus-4-6-v1";

const client = new BedrockRuntimeClient({
  region,
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          ...(process.env.AWS_SESSION_TOKEN
            ? { sessionToken: process.env.AWS_SESSION_TOKEN }
            : {}),
        },
      }
    : {}),
});

async function firstTokenMs(modelId) {
  const started = Date.now();
  let first = null;
  const res = await client.send(
    new ConverseStreamCommand({
      modelId,
      messages: [
        {
          role: "user",
          content: [{ text: "짧게 안녕만 해줘." }],
        },
      ],
      inferenceConfig: { maxTokens: 40, temperature: 0.4 },
    })
  );
  for await (const event of res.stream) {
    const delta = event.contentBlockDelta?.delta;
    if (delta && "text" in delta && delta.text) {
      if (first === null) first = Date.now() - started;
      break;
    }
  }
  return { modelId, firstTokenMs: first, totalMs: Date.now() - started };
}

console.log("STEP 1 Bedrock first-token bench");
console.log({ region, chatModel, legacyModel });

const chat = await firstTokenMs(chatModel);
console.log("CHAT (after)", chat);

const legacy = await firstTokenMs(legacyModel);
console.log("LEGACY Opus (before chat path)", legacy);

if (chat.firstTokenMs != null && legacy.firstTokenMs != null) {
  const saved = legacy.firstTokenMs - chat.firstTokenMs;
  console.log(
    `firstToken delta: ${saved}ms faster with chat model (${Math.round((saved / legacy.firstTokenMs) * 100)}%)`
  );
}
