/**
 * Local smoke: DynamoDB put/get + optional Bedrock via project env.
 * Usage: npx tsx scripts/aws/smoke-persist.ts
 */
import { createMapStore } from "../../src/backend/shared/persist/map-store";

async function main() {
  process.env.PERSISTENCE = process.env.PERSISTENCE || "dynamodb";
  process.env.AWS_REGION = process.env.AWS_REGION || "us-west-2";
  process.env.BEDI_DDB_TABLE = process.env.BEDI_DDB_TABLE || "BediApp";

  const store = createMapStore<{ userId: string; ping: string }>("smoke-test.json");
  const id = `smoke-${Date.now()}`;
  await store.set(id, { userId: id, ping: "ok" });
  const got = await store.get(id);
  console.log("dynamodb smoke", got);
  await store.delete(id);
  console.log("dynamodb smoke deleted");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
