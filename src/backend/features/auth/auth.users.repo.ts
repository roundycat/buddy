import "server-only";
import { env } from "@/backend/shared/config/env";
import type { AuthUser } from "./auth.types";
import {
  createDynamoUser,
  deleteDynamoUser,
  dynamoProfileToAuthUser,
  findDynamoUserByEmail,
  findDynamoUserById,
  upsertDynamoUser,
  verifyDynamoPassword,
  type DynamoUserProfile,
} from "./auth.users.dynamo.repo";
import {
  createJsonUser,
  deleteJsonUser,
  findJsonUserByEmail,
  findJsonUserById,
  upsertJsonUser,
  verifyJsonPassword,
} from "./auth.users.json.repo";

/**
 * Credential store chosen by AUTH_PROVIDER:
 *   json      → data-directory files (Render and other non-AWS hosting)
 *   otherwise → DynamoDB (AWS)
 */
export type UserProfileRow = DynamoUserProfile;

const jsonStore = () => env.authProvider === "json";

export function findUserByEmail(email: string): Promise<UserProfileRow | null> {
  return jsonStore() ? findJsonUserByEmail(email) : findDynamoUserByEmail(email);
}

export function findUserById(userId: string): Promise<UserProfileRow | null> {
  return jsonStore() ? findJsonUserById(userId) : findDynamoUserById(userId);
}

/**
 * Does the account behind a session still exist? A signed session outlives
 * account deletion (another tab or device keeps its cookie), so request
 * handlers ask here. Positive answers are cached briefly; deletion clears them.
 * A store error answers yes — the consent gate still applies — so an outage
 * does not log everyone out.
 */
const EXISTS_TTL_MS = 60_000;
const knownAccounts = new Map<string, number>();
/** Deleted in this process: a lookup that raced the delete must not re-cache it. */
const deletedAccounts = new Set<string>();

export async function accountExists(userId: string): Promise<boolean> {
  if (env.authProvider === "mock") return true;
  if (deletedAccounts.has(userId)) return false;
  const seen = knownAccounts.get(userId);
  if (seen && Date.now() - seen < EXISTS_TTL_MS) return true;
  try {
    const row = await findUserById(userId);
    if (row && !deletedAccounts.has(userId)) knownAccounts.set(userId, Date.now());
    else knownAccounts.delete(userId);
    return Boolean(row) && !deletedAccounts.has(userId);
  } catch (error) {
    console.error("[auth] account lookup failed", error);
    return true;
  }
}

export function verifyUserPassword(password: string, passwordHash: string): Promise<boolean> {
  return jsonStore()
    ? verifyJsonPassword(password, passwordHash)
    : verifyDynamoPassword(password, passwordHash);
}

export function createUser(input: {
  id: string;
  email: string;
  name: string;
  role: "child" | "guardian";
  password: string;
}): Promise<AuthUser> {
  return jsonStore() ? createJsonUser(input) : createDynamoUser(input);
}

export function deleteUser(userId: string): Promise<boolean> {
  deletedAccounts.add(userId);
  knownAccounts.delete(userId);
  return jsonStore() ? deleteJsonUser(userId) : deleteDynamoUser(userId);
}

export function upsertUser(input: {
  id: string;
  email: string;
  name: string;
  role: "child" | "guardian";
  password: string;
}): Promise<AuthUser> {
  // Seeding can bring back an account id that was deleted earlier.
  deletedAccounts.delete(input.id);
  return jsonStore() ? upsertJsonUser(input) : upsertDynamoUser(input);
}

export function profileToAuthUser(row: UserProfileRow): AuthUser {
  return dynamoProfileToAuthUser(row);
}
