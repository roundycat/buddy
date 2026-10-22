import "server-only";
import bcrypt from "bcryptjs";
import {
  DeleteCommand,
  GetCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { bediTableName, getDynamoDocClient } from "@/backend/shared/persist/dynamodb-client";
import type { AuthUser } from "./auth.types";

/**
 * DynamoDB auth users — dedicated keys (NOT createMapStore).
 *   pk=USER#<userId>  sk=PROFILE
 *   pk=EMAIL#<email>  sk=UNIQUE → userId
 */

export type DynamoUserProfile = {
  userId: string;
  email: string;
  name: string;
  role: "child" | "guardian";
  passwordHash: string;
  createdAt: string;
};

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyDynamoPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

function emailPk(email: string) {
  return `EMAIL#${email.trim().toLowerCase()}`;
}

function userPk(userId: string) {
  return `USER#${userId}`;
}

export async function findDynamoUserByEmail(
  email: string
): Promise<DynamoUserProfile | null> {
  const doc = getDynamoDocClient();
  const table = bediTableName();
  const emailKey = await doc.send(
    new GetCommand({
      TableName: table,
      Key: { pk: emailPk(email), sk: "UNIQUE" },
    })
  );
  const userId = emailKey.Item?.userId as string | undefined;
  if (!userId) return null;

  const profile = await doc.send(
    new GetCommand({
      TableName: table,
      Key: { pk: userPk(userId), sk: "PROFILE" },
    })
  );
  const item = profile.Item;
  if (!item?.passwordHash) return null;
  return {
    userId: String(item.userId ?? userId),
    email: String(item.email),
    name: String(item.name),
    role: item.role === "guardian" ? "guardian" : "child",
    passwordHash: String(item.passwordHash),
    createdAt: String(item.createdAt ?? ""),
  };
}

export async function findDynamoUserById(
  userId: string
): Promise<DynamoUserProfile | null> {
  const doc = getDynamoDocClient();
  const profile = await doc.send(
    new GetCommand({
      TableName: bediTableName(),
      Key: { pk: userPk(userId), sk: "PROFILE" },
    })
  );
  const item = profile.Item;
  if (!item?.passwordHash) return null;
  return {
    userId: String(item.userId ?? userId),
    email: String(item.email),
    name: String(item.name),
    role: item.role === "guardian" ? "guardian" : "child",
    passwordHash: String(item.passwordHash),
    createdAt: String(item.createdAt ?? ""),
  };
}

export async function createDynamoUser(input: {
  id: string;
  email: string;
  name: string;
  role: "child" | "guardian";
  password: string;
}): Promise<AuthUser> {
  const doc = getDynamoDocClient();
  const table = bediTableName();
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const createdAt = new Date().toISOString();

  try {
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: table,
              Item: {
                pk: emailPk(email),
                sk: "UNIQUE",
                userId: input.id,
                createdAt,
              },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
          {
            Put: {
              TableName: table,
              Item: {
                pk: userPk(input.id),
                sk: "PROFILE",
                userId: input.id,
                email,
                name: input.name,
                role: input.role,
                passwordHash,
                createdAt,
              },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
        ],
      })
    );
  } catch (error) {
    const name =
      typeof error === "object" && error && "name" in error
        ? String((error as { name?: unknown }).name)
        : "";
    if (
      name === "TransactionCanceledException" ||
      name === "ConditionalCheckFailedException"
    ) {
      throw new Error("DUPLICATE_EMAIL");
    }
    throw error;
  }

  return {
    id: input.id,
    email,
    name: input.name,
    role: input.role,
  };
}

export async function deleteDynamoUser(userId: string): Promise<boolean> {
  const doc = getDynamoDocClient();
  const table = bediTableName();
  const profile = await doc.send(
    new GetCommand({
      TableName: table,
      Key: { pk: userPk(userId), sk: "PROFILE" },
    })
  );
  const email = profile.Item?.email as string | undefined;
  if (!email) return false;

  try {
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: table,
              Key: { pk: emailPk(email), sk: "UNIQUE" },
            },
          },
          {
            Delete: {
              TableName: table,
              Key: { pk: userPk(userId), sk: "PROFILE" },
            },
          },
        ],
      })
    );
    return true;
  } catch {
    await Promise.all([
      doc.send(
        new DeleteCommand({
          TableName: table,
          Key: { pk: emailPk(email), sk: "UNIQUE" },
        })
      ),
      doc.send(
        new DeleteCommand({
          TableName: table,
          Key: { pk: userPk(userId), sk: "PROFILE" },
        })
      ),
    ]);
    return true;
  }
}

export function dynamoProfileToAuthUser(row: DynamoUserProfile): AuthUser {
  return {
    id: row.userId,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

/** Upsert for seeding (overwrites password). */
export async function upsertDynamoUser(input: {
  id: string;
  email: string;
  name: string;
  role: "child" | "guardian";
  password: string;
}): Promise<AuthUser> {
  const existing = await findDynamoUserByEmail(input.email);
  if (existing) {
    await deleteDynamoUser(existing.userId);
  }
  return createDynamoUser(input);
}
