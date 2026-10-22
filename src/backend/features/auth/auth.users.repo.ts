import "server-only";
import { env } from "@/backend/shared/config/env";
import type { AuthUser } from "./auth.types";
import {
  createDynamoUser,
  deleteDynamoUser,
  dynamoProfileToAuthUser,
  findDynamoUserByEmail,
  upsertDynamoUser,
  verifyDynamoPassword,
  type DynamoUserProfile,
} from "./auth.users.dynamo.repo";
import {
  createJsonUser,
  deleteJsonUser,
  findJsonUserByEmail,
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
  return jsonStore() ? deleteJsonUser(userId) : deleteDynamoUser(userId);
}

export function upsertUser(input: {
  id: string;
  email: string;
  name: string;
  role: "child" | "guardian";
  password: string;
}): Promise<AuthUser> {
  return jsonStore() ? upsertJsonUser(input) : upsertDynamoUser(input);
}

export function profileToAuthUser(row: UserProfileRow): AuthUser {
  return dynamoProfileToAuthUser(row);
}
