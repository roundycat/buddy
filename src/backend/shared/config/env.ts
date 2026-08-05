/**
 * Backend environment configuration.
 * Values come from `.env.local` (see `.env.example`).
 */

export type LlmProviderName = "mock" | "openai" | "bedrock";
export type PersistenceMode = "json" | "dynamodb";
export type AuthProviderName = "dynamodb" | "aurora" | "mock" | "auto";

function read(key: string, fallback = ""): string {
  return (process.env[key] ?? fallback).trim();
}

function readBool(key: string, fallback = false): boolean {
  const value = read(key).toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes";
}

function readInt(key: string, fallback: number): number {
  const n = Number.parseInt(read(key), 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  appUrl: read("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),

  /**
   * Local MVP: json (.data files)
   * Cloud: dynamodb (BediApp single table)
   */
  persistence: (read("PERSISTENCE", "json") || "json") as PersistenceMode,

  dynamodb: {
    tableName: read("BEDI_DDB_TABLE", "BediApp"),
    region: read("AWS_REGION", "us-east-1"),
  },

  /** aurora | dynamodb | mock — login credential store (no silent auto→mock in prod) */
  authProvider: (read("AUTH_PROVIDER", "dynamodb") ||
    "dynamodb") as AuthProviderName,

  /** Aurora PostgreSQL (RDS) */
  database: {
    url: read("DATABASE_URL"),
    host: read("PGHOST") || read("DB_HOST"),
    port: readInt("PGPORT", readInt("DB_PORT", 5432)),
    name: read("PGDATABASE") || read("DB_NAME", "bedi"),
    user: read("PGUSER") || read("DB_USER", "bediadmin"),
    password: read("PGPASSWORD") || read("DB_PASSWORD"),
    ssl: readBool("PGSSL", true),
  },

  /** mock | openai | bedrock */
  llmProvider: (read("LLM_PROVIDER", "mock") || "mock") as LlmProviderName,

  /** Fallback to mock when LLM call fails */
  llmFallbackToMock: readBool("LLM_FALLBACK_TO_MOCK", true),

  openai: {
    apiKey: read("OPENAI_API_KEY"),
    baseUrl: read("OPENAI_BASE_URL", "https://api.openai.com/v1").replace(
      /\/$/,
      ""
    ),
    model: read("OPENAI_MODEL", "gpt-4o-mini"),
  },

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
    /** Bedrock Guardrail (STEP 3) — applied on Converse via Orchestrator */
    guardrailId: read("BEDROCK_GUARDRAIL_ID"),
    guardrailVersion: read("BEDROCK_GUARDRAIL_VERSION", "DRAFT"),
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
} as const;

export function isLlmConfigured(
  provider: LlmProviderName = env.llmProvider
): boolean {
  if (provider === "mock") return true;
  if (provider === "openai") return Boolean(env.openai.apiKey);
  if (provider === "bedrock") return Boolean(env.bedrock.modelId);
  return false;
}

export function isDynamoPersistence(): boolean {
  return env.persistence === "dynamodb";
}
