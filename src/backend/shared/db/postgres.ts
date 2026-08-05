import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env } from "@/backend/shared/config/env";

/**
 * Aurora PostgreSQL pool (users / auth).
 * Prefer DATABASE_URL; falls back to discrete PG* vars.
 */

let pool: Pool | null = null;

export function isAuroraConfigured(): boolean {
  return Boolean(env.database.url || (env.database.host && env.database.password));
}

export function getPool(): Pool {
  if (pool) return pool;

  if (env.database.url) {
    pool = new Pool({
      connectionString: env.database.url,
      ssl: env.database.ssl ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  } else if (env.database.host && env.database.password) {
    pool = new Pool({
      host: env.database.host,
      port: env.database.port,
      database: env.database.name,
      user: env.database.user,
      password: env.database.password,
      ssl: env.database.ssl ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  } else {
    throw new Error("DATABASE_URL (or PGHOST/PGPASSWORD) is not configured.");
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return getPool().query<T>(text, params);
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
