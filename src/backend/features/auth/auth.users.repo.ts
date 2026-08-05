import bcrypt from "bcryptjs";
import { query } from "@/backend/shared/db/postgres";
import type { AuthUser } from "./auth.types";

export type DbUserRow = {
  id: string;
  email: string;
  name: string;
  role: "child" | "guardian";
  password_hash: string;
};

export async function ensureUsersTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('child', 'guardian')),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)`);
}

export async function findUserByEmail(email: string): Promise<DbUserRow | null> {
  const result = await query<DbUserRow>(
    `SELECT id, email, name, role, password_hash
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email.trim()]
  );
  return result.rows[0] ?? null;
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function upsertUser(input: {
  id: string;
  email: string;
  name: string;
  role: "child" | "guardian";
  password: string;
}): Promise<AuthUser> {
  const passwordHash = await hashPassword(input.password);
  await query(
    `INSERT INTO users (id, email, name, role, password_hash)
     VALUES ($1, lower($2), $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       password_hash = EXCLUDED.password_hash
     `,
    [input.id, input.email, input.name, input.role, passwordHash]
  );
  return {
    id: input.id,
    email: input.email.trim().toLowerCase(),
    name: input.name,
    role: input.role,
  };
}

/** Insert-only signup. Throws if email already exists. */
export async function createUser(input: {
  id: string;
  email: string;
  name: string;
  role: "child" | "guardian";
  password: string;
}): Promise<AuthUser> {
  await ensureUsersTable();
  const passwordHash = await hashPassword(input.password);
  try {
    await query(
      `INSERT INTO users (id, email, name, role, password_hash)
       VALUES ($1, lower($2), $3, $4, $5)`,
      [input.id, input.email, input.name, input.role, passwordHash]
    );
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "23505") {
      throw new Error("DUPLICATE_EMAIL");
    }
    throw error;
  }
  return {
    id: input.id,
    email: input.email.trim().toLowerCase(),
    name: input.name,
    role: input.role,
  };
}

export async function deleteUserById(userId: string): Promise<boolean> {
  const result = await query(`DELETE FROM users WHERE id = $1`, [userId]);
  return (result.rowCount ?? 0) > 0;
}

export async function deleteUserByEmail(email: string): Promise<boolean> {
  const result = await query(`DELETE FROM users WHERE lower(email) = lower($1)`, [
    email.trim(),
  ]);
  return (result.rowCount ?? 0) > 0;
}

export function toAuthUser(row: DbUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}
