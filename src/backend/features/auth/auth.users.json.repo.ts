import "server-only";
import bcrypt from "bcryptjs";
import { createJsonMapStore } from "@/backend/shared/persist/json-map-store";
import type { AuthUser } from "./auth.types";
import type { DynamoUserProfile } from "./auth.users.dynamo.repo";

/**
 * File-backed auth users for hosting without DynamoDB (AUTH_PROVIDER=json).
 * Same contract as auth.users.dynamo.repo. Passwords are bcrypt hashes; the files
 * live in the data directory (BEDDY_DATA_DIR, a persistent disk in production).
 *
 *   auth-users.json   userId → profile (with passwordHash)
 *   auth-emails.json  email  → { userId }
 *
 * One Node process owns the files; each operation below runs without awaiting
 * between the uniqueness check and the write, so two sign-ups cannot both claim
 * one e-mail.
 */

type EmailIndexRow = { userId: string };

const users = createJsonMapStore<DynamoUserProfile>("auth-users.json");
const emails = createJsonMapStore<EmailIndexRow>("auth-emails.json", {
  userIdKey: "userId",
});

const normalize = (email: string) => email.trim().toLowerCase();

export async function verifyJsonPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function findJsonUserByEmail(
  email: string
): Promise<DynamoUserProfile | null> {
  const userId = emails.get(normalize(email))?.userId;
  if (!userId) return null;
  const row = users.get(userId);
  return row?.passwordHash ? row : null;
}

export async function findJsonUserById(userId: string): Promise<DynamoUserProfile | null> {
  return users.get(userId) ?? null;
}

export async function createJsonUser(input: {
  id: string;
  email: string;
  name: string;
  role: "child" | "guardian";
  password: string;
}): Promise<AuthUser> {
  const email = normalize(input.email);
  const passwordHash = await bcrypt.hash(input.password, 10);
  // No await between the check and the writes below.
  if (emails.has(email) || users.has(input.id)) throw new Error("DUPLICATE_EMAIL");
  const row: DynamoUserProfile = {
    userId: input.id,
    email,
    name: input.name,
    role: input.role,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.set(input.id, row);
  emails.set(email, { userId: input.id });
  return { id: input.id, email, name: input.name, role: input.role };
}

export async function deleteJsonUser(userId: string): Promise<boolean> {
  const row = users.get(userId);
  if (!row) return false;
  emails.delete(normalize(row.email));
  users.delete(userId);
  return true;
}

/** Upsert for seeding (overwrites password). */
export async function upsertJsonUser(input: {
  id: string;
  email: string;
  name: string;
  role: "child" | "guardian";
  password: string;
}): Promise<AuthUser> {
  const existing = await findJsonUserByEmail(input.email);
  if (existing) await deleteJsonUser(existing.userId);
  if (users.has(input.id)) await deleteJsonUser(input.id);
  return createJsonUser(input);
}
