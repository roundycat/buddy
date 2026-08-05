/**
 * Local smoke: DynamoDB put/get + optional Bedrock via project env.
 * Usage: npx tsx scripts/aws/smoke-persist.ts
 *
 * 프로덕션 테이블 대상 실행 금지.
 * BEDI_DDB_TABLE 이 BediApp 이면 중단한다 (데모 데이터 오염 방지).
 */
import { createMapStore } from "../../src/backend/shared/persist/map-store";

async function main() {
  const table = process.env.BEDI_DDB_TABLE || "BediApp";
  if (table === "BediApp") {
    console.error(
      `[smoke-persist] refused: BEDI_DDB_TABLE=${table} is the production table.`
    );
    console.error(
      "Point BEDI_DDB_TABLE at a disposable test table, or do not run this script."
    );
    process.exit(1);
  }

  process.env.PERSISTENCE = process.env.PERSISTENCE || "dynamodb";
  process.env.AWS_REGION = process.env.AWS_REGION || "us-west-2";

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
