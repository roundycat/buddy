/**
 * Seed Aurora `users` table with 4 demo accounts.
 *
 * Usage: npm run seed:aurora
 */
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const USERS = [
  {
    id: "user-demo-01",
    name: "\uC9C0\uBBFC",
    email: "demo@bedi.app",
    password: "BeddyDemo26!",
    role: "child",
  },
  {
    id: "user-demo-02",
    name: "\uC11C\uC5F0",
    email: "guest@bedi.app",
    password: "BeddyGuest26!",
    role: "child",
  },
  {
    id: "user-demo-03",
    name: "\uBBF8\uB098",
    email: "mina@bedi.app",
    password: "BeddyMina26!",
    role: "child",
  },
  {
    id: "user-demo-04",
    name: "\uD558\uB8E8",
    email: "haru@bedi.app",
    password: "BeddyHaru26!",
    role: "child",
  },
  {
    id: "user-guardian-01",
    name: "\uBCF4\uD638\uC790",
    email: "guardian@bedi.app",
    password: "BeddyGuard26!",
    role: "guardian",
  },
  {
    id: "user-guardian-02",
    name: "\uC5C4\uB9C8",
    email: "parent@bedi.app",
    password: "BeddyParent26!",
    role: "guardian",
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  const host = process.env.PGHOST || process.env.DB_HOST;
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD;

  if (!url && !(host && password)) {
    throw new Error("Set DATABASE_URL or PGHOST+PGPASSWORD before seeding.");
  }

  const client = url
    ? new Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
      })
    : new Client({
        host,
        port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
        database: process.env.PGDATABASE || process.env.DB_NAME || "bedi",
        user: process.env.PGUSER || process.env.DB_USER || "bediadmin",
        password,
        ssl: { rejectUnauthorized: false },
      });

  await client.connect();
  console.log("Connected to Aurora");

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
  await client.query(`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)`);

  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await client.query(
      `INSERT INTO users (id, email, name, role, password_hash)
       VALUES ($1, lower($2), $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         id = EXCLUDED.id,
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         password_hash = EXCLUDED.password_hash`,
      [u.id, u.email, u.name, u.role, hash]
    );
    console.log(`upserted ${u.email} (${u.role})`);
  }

  await client.end();
  console.log("Done — child x4 + guardian x2 ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
