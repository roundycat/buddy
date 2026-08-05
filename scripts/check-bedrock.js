const fs = require("fs");
const {
  BedrockRuntimeClient,
  ConverseCommand,
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
  const region = env.AWS_REGION || "us-west-2";
  const modelId = env.BEDROCK_MODEL_ID;
  const accessKeyId = env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;

  console.log(
    JSON.stringify(
      {
        check: "bedrock-preflight",
        region,
        modelId,
        hasAccessKey: Boolean(accessKeyId),
        hasSecret: Boolean(secretAccessKey),
        accessKeyPrefix: accessKeyId ? `${accessKeyId.slice(0, 4)}…` : null,
        llmProviderEnv: env.LLM_PROVIDER,
      },
      null,
      2
    )
  );

  if (!accessKeyId || !secretAccessKey || !modelId) {
    console.log(
      JSON.stringify({ ok: false, error: "missing credentials or model id" })
    );
    process.exit(1);
  }

  const client = new BedrockRuntimeClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    const res = await client.send(
      new ConverseCommand({
        modelId,
        messages: [
          {
            role: "user",
            content: [{ text: "Reply with exactly: BEDROCK_OK" }],
          },
        ],
        inferenceConfig: { maxTokens: 32, temperature: 0 },
      })
    );
    const text = (res.output?.message?.content || [])
      .map((b) => b.text || "")
      .join("")
      .trim();
    console.log(
      JSON.stringify(
        {
          ok: true,
          modelId,
          replyPreview: text.slice(0, 120),
          stopReason: res.stopReason || null,
        },
        null,
        2
      )
    );
  } catch (err) {
    const meta = err && err.$metadata ? err.$metadata : {};
    console.log(
      JSON.stringify(
        {
          ok: false,
          name: err.name,
          message: String(err.message || err).slice(0, 600),
          httpStatusCode: meta.httpStatusCode || null,
        },
        null,
        2
      )
    );
    process.exit(2);
  }
})();
