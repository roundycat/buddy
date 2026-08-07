/**
 * Seed DynamoDB auth users (STEP 5-4).
 * Usage: node --env-file=.env.local scripts/seed/seed-dynamo-users.js
 *
 * 계정 목록이 auth.service.ts MOCK_USERS / wipe-fresh-start.js 와 중복이다.
 * 하나를 바꾸면 나머지도 바꿔야 한다. 데모 후 공유 상수로 통합 예정.
 */
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand,
  TransactWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const bcrypt = require("bcryptjs");

const TABLE = process.env.BEDI_DDB_TABLE || "BediApp";
const REGION = process.env.AWS_REGION || "us-east-1";

const USERS = [
  {
    id: "user-demo-01",
    name: "지민",
    email: "demo@bedi.app",
    password: "BeddyDemo26!",
    role: "child",
  },
  {
    id: "user-demo-02",
    name: "서연",
    email: "guest@bedi.app",
    password: "BeddyGuest26!",
    role: "child",
  },
  {
    id: "user-demo-03",
    name: "미나",
    email: "mina@bedi.app",
    password: "BeddyMina26!",
    role: "child",
  },
  {
    id: "user-demo-04",
    name: "하루",
    email: "haru@bedi.app",
    password: "BeddyHaru26!",
    role: "child",
  },
  {
    id: "user-guardian-01",
    name: "보호자",
    email: "guardian@bedi.app",
    password: "BeddyGuard26!",
    role: "guardian",
  },
  {
    id: "user-guardian-02",
    name: "엄마",
    email: "parent@bedi.app",
    password: "BeddyParent26!",
    role: "guardian",
  },
];

function emailPk(email) {
  return `EMAIL#${email.trim().toLowerCase()}`;
}
function userPk(id) {
  return `USER#${id}`;
}

async function main() {
  const raw = new DynamoDBClient({
    region: REGION,
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
  const doc = DynamoDBDocumentClient.from(raw, {
    marshallOptions: { removeUndefinedValues: true },
  });

  for (const u of USERS) {
    const email = u.email.toLowerCase();
    const existingEmail = await doc.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: emailPk(email), sk: "UNIQUE" },
      })
    );
    if (existingEmail.Item?.userId) {
      const oldId = existingEmail.Item.userId;
      await doc.send(
        new DeleteCommand({
          TableName: TABLE,
          Key: { pk: emailPk(email), sk: "UNIQUE" },
        })
      );
      await doc.send(
        new DeleteCommand({
          TableName: TABLE,
          Key: { pk: userPk(oldId), sk: "PROFILE" },
        })
      );
    }

    const passwordHash = await bcrypt.hash(u.password, 10);
    const createdAt = new Date().toISOString();
    await doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE,
              Item: {
                pk: emailPk(email),
                sk: "UNIQUE",
                userId: u.id,
                createdAt,
              },
            },
          },
          {
            Put: {
              TableName: TABLE,
              Item: {
                pk: userPk(u.id),
                sk: "PROFILE",
                userId: u.id,
                email,
                name: u.name,
                role: u.role,
                passwordHash,
                createdAt,
              },
            },
          },
        ],
      })
    );
    console.log(`seeded ${u.email} (${u.role})`);
  }
  console.log("DONE — demo passwords rotated (see docs/aws/step5-security.md)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
