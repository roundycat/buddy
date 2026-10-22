/**
 * Backend environment configuration.
 * Values come from `.env.local` (see `.env.example`).
 */

export type LlmProviderName = "mock" | "bedrock" | "anthropic";
export type PersistenceMode = "json" | "dynamodb";
export type AuthProviderName = "dynamodb" | "json" | "mock" | "auto";
export type ImageProviderName = "bedrock" | "bundled";
export type TtsProviderName = "polly" | "browser";
export type AnthropicEffort = "low" | "medium" | "high";

function read(key: string, fallback = ""): string {
  return (process.env[key] ?? fallback).trim();
}

function readBool(key: string, fallback = false): boolean {
  const value = read(key).toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes";
}

export const env = {
  /** Render sets RENDER_EXTERNAL_URL at runtime; an explicit value wins. */
  appUrl:
    read("NEXT_PUBLIC_APP_URL") ||
    read("RENDER_EXTERNAL_URL") ||
    "http://localhost:3000",

  /**
   * Local MVP: json (.data files)
   * Cloud: dynamodb (BediApp single table)
   */
  persistence: (read("PERSISTENCE", "json") || "json") as PersistenceMode,

  dynamodb: {
    tableName: read("BEDI_DDB_TABLE", "BediApp"),
    region: read("AWS_REGION", "us-east-1"),
  },

  /**
   * dynamodb | json | mock | auto — login credential store (no silent auto→mock in prod).
   * json keeps bcrypt hashes in the data directory (non-AWS hosting).
   */
  authProvider: (read("AUTH_PROVIDER", "dynamodb") ||
    "dynamodb") as AuthProviderName,

  /** mock | bedrock | anthropic (Claude API, non-AWS hosting) */
  llmProvider: (read("LLM_PROVIDER", "mock") || "mock") as LlmProviderName,

  /**
   * Claude API (api.anthropic.com). Used when LLM_PROVIDER=anthropic.
   * Effort / thinking are per purpose: chat (child companion), analysis (short JSON
   * tasks, safety review), quality (dawn batch, storybook).
   */
  anthropic: {
    apiKey: read("ANTHROPIC_API_KEY"),
    baseUrl: read("ANTHROPIC_BASE_URL", "https://api.anthropic.com").replace(/\/+$/, ""),
    chatModel: read("ANTHROPIC_MODEL_CHAT", "claude-haiku-5-5"),
    qualityModel: read(
      "ANTHROPIC_MODEL_QUALITY",
      read("ANTHROPIC_MODEL_CHAT", "claude-haiku-5-5")
    ),
    chatEffort: (read("ANTHROPIC_EFFORT_CHAT", "low") || "low") as AnthropicEffort,
    analysisEffort: (read("ANTHROPIC_EFFORT_ANALYSIS", "low") || "low") as AnthropicEffort,
    qualityEffort: (read("ANTHROPIC_EFFORT_QUALITY", "medium") || "medium") as AnthropicEffort,
    /** adaptive | disabled — thinking for the child chat path */
    chatThinking: (read("ANTHROPIC_THINKING_CHAT", "adaptive") || "adaptive") as
      | "adaptive"
      | "disabled",
    timeoutMs: Number(read("ANTHROPIC_TIMEOUT_MS", "45000")) || 45000,
  },

  /**
   * Fallback to mock when LLM call fails.
   * Local default: true (dev ergonomics).
   * Production default: false (never silently fake answers for real users).
   */
  llmFallbackToMock: readBool(
    "LLM_FALLBACK_TO_MOCK",
    process.env.NODE_ENV !== "production"
  ),

  bedrock: {
    region: read("AWS_REGION", "us-east-1"),
    /**
     * Legacy single model id (compat). Prefer chatModelId / qualityModelId.
     * Default stays Haiku; existing .env may still point at Opus.
     */
    modelId: read(
      "BEDROCK_MODEL_ID",
      "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    ),
    /** Immediate path (child chat / light analysis) — speed first */
    chatModelId: read(
      "BEDROCK_MODEL_ID_CHAT",
      "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    ),
    /** Batch / quality path — defaults to legacy BEDROCK_MODEL_ID */
    qualityModelId: read(
      "BEDROCK_MODEL_ID_QUALITY",
      read(
        "BEDROCK_MODEL_ID",
        "us.anthropic.claude-haiku-4-5-20251001-v1:0"
      )
    ),
    /** Stability image models currently available in us-west-2 for this account */
    imageModelId: read(
      "BEDROCK_IMAGE_MODEL_ID",
      "stability.stable-image-core-v1:1"
    ),
    imageRegion: read("BEDROCK_IMAGE_REGION", "us-west-2"),
    imageRemoveBgModelId: read(
      "BEDROCK_IMAGE_REMOVE_BG_MODEL_ID",
      "us.stability.stable-image-remove-background-v1:0"
    ),
    /** Bedrock Guardrail (STEP 3) — applied on Converse via the LLM Gateway */
    guardrailId: read("BEDROCK_GUARDRAIL_ID"),
    guardrailVersion: read("BEDROCK_GUARDRAIL_VERSION", "DRAFT"),
    /** Bedrock Knowledge Base id (STEP 6) — summaries only */
    knowledgeBaseId: read("BEDROCK_KB_ID"),
    /** KB data source to re-ingest after the dawn batch writes summaries */
    knowledgeBaseDataSourceId: read("BEDROCK_KB_DATA_SOURCE_ID"),
    accessKeyId: read("AWS_ACCESS_KEY_ID"),
    secretAccessKey: read("AWS_SECRET_ACCESS_KEY"),
    sessionToken: read("AWS_SESSION_TOKEN"),
  },

  /**
   * Persona avatar binary storage.
   * Local: .data/avatars ; Cloud: private S3 + /api/persona/avatar
   * TODO [AWS S3]: set AVATAR_S3_BUCKET on ECS
   */
  avatar: {
    s3Bucket: read("AVATAR_S3_BUCKET"),
    s3Region: read("AVATAR_S3_REGION", read("AWS_REGION", "us-east-1")),
  },

  /**
   * Image generation: bedrock (Stability on Bedrock) | bundled (pre-made crayon drawings).
   * Defaults to bedrock only when the LLM provider is bedrock.
   */
  imageProvider: (read("IMAGE_PROVIDER") ||
    (read("LLM_PROVIDER") === "bedrock" ? "bedrock" : "bundled")) as ImageProviderName,

  /** Storybook narration: polly (Amazon Polly) | browser (speechSynthesis on the device) */
  ttsProvider: (read("TTS_PROVIDER") ||
    (read("LLM_PROVIDER") === "bedrock" ? "polly" : "browser")) as TtsProviderName,

  /** Shared secret for EventBridge → /api/cron/* (header x-bedi-cron-secret) */
  cronSecret: read("CRON_SECRET"),
} as const;

export function isLlmConfigured(
  provider: LlmProviderName = env.llmProvider
): boolean {
  if (provider === "mock") return true;
  if (provider === "bedrock") return Boolean(env.bedrock.modelId);
  if (provider === "anthropic") return Boolean(env.anthropic.apiKey);
  return false;
}

export function isDynamoPersistence(): boolean {
  return env.persistence === "dynamodb";
}
