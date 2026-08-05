/**
 * Fresh-start wipe: Aurora users + DynamoDB app data + local .data.
 * Then re-seeds demo accounts (same as seed-aurora-users.js).
 *
 * Usage:
 *   node --env-file=.env.local scripts/wipe-fresh-start.js
 *   node --env-file=.env.local scripts/wipe-fresh-start.js --no-seed
 *   node --env-file=.env.local scripts/wipe-fresh-start.js --skip-dynamo
 *   node --env-file=.env.local scripts/wipe-fresh-start.js --skip-s3
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");
const {
  DynamoDBClient,
  DescribeTableCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require("@aws-sdk/client-s3");

const args = new Set(process.argv.slice(2));
const NO_SEED = args.has("--no-seed");
const SKIP_DYNAMO = args.has("--skip-dynamo");
const SKIP_S3 = args.has("--skip-s3");
const SKIP_LOCAL = args.has("--skip-local");

const DEMO_USERS = [
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

function awsCreds() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  if (accessKeyId && secretAccessKey) {
    return {
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    };
  }
  return {};
}

function pgClient() {
  const url = process.env.DATABASE_URL;
  const host = process.env.PGHOST || process.env.DB_HOST;
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD;
  if (!url && !(host && password)) return null;

  if (url) {
    return new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
  }
  return new Client({
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || "bedi",
    user: process.env.PGUSER || process.env.DB_USER || "bediadmin",
    password,
    ssl:
      String(process.env.PGSSL || "true").toLowerCase() !== "false"
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

async function wipeAurora() {
  const client = pgClient();
  if (!client) {
    console.log("[aurora] skipped (no PGHOST/DATABASE_URL)");
    return;
  }

  await client.connect();
  console.log("[aurora] connected");

  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('child', 'guardian')),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const before = await client.query(`SELECT count(*)::int AS n FROM users`);
  console.log(`[aurora] users before: ${before.rows[0].n}`);

  await client.query(`DELETE FROM users`);
  console.log("[aurora] deleted all users");

  if (!NO_SEED) {
    for (const u of DEMO_USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      await client.query(
        `INSERT INTO users (id, email, name, role, password_hash)
         VALUES ($1, lower($2), $3, $4, $5)`,
        [u.id, u.email, u.name, u.role, hash]
      );
      console.log(`[aurora] seeded ${u.email} (${u.role})`);
    }
  }

  const after = await client.query(`SELECT count(*)::int AS n FROM users`);
  console.log(`[aurora] users after: ${after.rows[0].n}`);
  await client.end();
}

async function wipeDynamo() {
  if (SKIP_DYNAMO) {
    console.log("[dynamo] skipped");
    return;
  }

  const table = process.env.BEDI_DDB_TABLE || "BediApp";
  const region =
    process.env.BEDI_DDB_REGION ||
    process.env.AWS_REGION ||
    "us-east-1";

  const raw = new DynamoDBClient({ region, ...awsCreds() });
  const doc = DynamoDBDocumentClient.from(raw, {
    marshallOptions: { removeUndefinedValues: true },
  });

  try {
    await raw.send(new DescribeTableCommand({ TableName: table }));
  } catch (error) {
    console.log(
      `[dynamo] table ${table} (@${region}) not found / unreachable — skip`,
      error instanceof Error ? error.message : error
    );
    return;
  }

  let deleted = 0;
  let startKey;
  do {
    const page = await doc.send(
      new ScanCommand({
        TableName: table,
        ExclusiveStartKey: startKey,
        ProjectionExpression: "pk, sk",
      })
    );
    const items = page.Items || [];
    for (let i = 0; i < items.length; i += 25) {
      const chunk = items.slice(i, i + 25);
      await doc.send(
        new BatchWriteCommand({
          RequestItems: {
            [table]: chunk.map((item) => ({
              DeleteRequest: { Key: { pk: item.pk, sk: item.sk } },
            })),
          },
        })
      );
      deleted += chunk.length;
    }
    startKey = page.LastEvaluatedKey;
  } while (startKey);

  console.log(`[dynamo] deleted ${deleted} items from ${table} (${region})`);
}

async function wipeLocalData() {
  if (SKIP_LOCAL) {
    console.log("[local] skipped");
    return;
  }

  const dataDir = path.join(process.cwd(), ".data");
  if (!fs.existsSync(dataDir)) {
    console.log("[local] .data missing — skip");
    return;
  }

  let n = 0;
  for (const name of fs.readdirSync(dataDir)) {
    if (!name.endsWith(".json")) continue;
    fs.writeFileSync(path.join(dataDir, name), "{}\n", "utf8");
    n += 1;
    console.log(`[local] cleared ${name}`);
  }

  for (const sub of ["avatars", "schedule-images"]) {
    const dir = path.join(dataDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      fs.unlinkSync(path.join(dir, name));
      n += 1;
    }
    console.log(`[local] cleared ${sub}/`);
  }

  console.log(`[local] done (${n} files touched)`);
}

async function wipeS3Prefix(bucket, region, prefix) {
  const s3 = new S3Client({ region, ...awsCreds() });
  let deleted = 0;
  let token;
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    const objs = listed.Contents || [];
    for (let i = 0; i < objs.length; i += 1000) {
      const chunk = objs.slice(i, i + 1000).filter((o) => o.Key);
      if (chunk.length === 0) continue;
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: chunk.map((o) => ({ Key: o.Key })),
            Quiet: true,
          },
        })
      );
      deleted += chunk.length;
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}

async function wipeS3() {
  if (SKIP_S3) {
    console.log("[s3] skipped");
    return;
  }

  const bucket = process.env.AVATAR_S3_BUCKET;
  if (!bucket) {
    console.log("[s3] skipped (no AVATAR_S3_BUCKET)");
    return;
  }

  const region =
    process.env.AVATAR_S3_REGION || process.env.AWS_REGION || "us-east-1";

  try {
    const a = await wipeS3Prefix(bucket, region, "avatars/");
    const b = await wipeS3Prefix(bucket, region, "schedule-images/");
    const c = await wipeS3Prefix(bucket, region, "photos/");
    console.log(
      `[s3] deleted avatars=${a}, schedule-images=${b}, photos=${c} from s3://${bucket}`
    );
  } catch (error) {
    console.warn(
      "[s3] wipe failed:",
      error instanceof Error ? error.message : error
    );
  }
}

async function main() {
  console.log("=== Beddy fresh-start wipe ===");
  console.log(
    `flags: seed=${!NO_SEED} dynamo=${!SKIP_DYNAMO} s3=${!SKIP_S3} local=${!SKIP_LOCAL}`
  );

  await wipeAurora();
  await wipeDynamo();
  await wipeLocalData();
  await wipeS3();

  console.log("=== done ===");
  if (!NO_SEED) {
    console.log("Demo logins:");
    console.log("  child    demo@bedi.app / BeddyDemo26!");
    console.log("  guardian guardian@bedi.app / BeddyGuard26!");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
