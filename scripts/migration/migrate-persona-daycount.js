const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const region = process.env.AWS_REGION || "us-east-1";
const tableName = process.env.BEDI_DDB_TABLE || "BediApp";
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

function journeyStartForDayThree(now = new Date()) {
  const start = new Date(now);
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - 2);
  return start.toISOString();
}

async function main() {
  const result = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "MAP#personas" },
    })
  );

  const items = result.Items || [];
  const legacy = items.filter(
    (item) => item.data?.setupCompleted && !item.data?.journeyStartedAt
  );
  const journeyStartedAt = journeyStartForDayThree();

  for (const item of legacy) {
    await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: item.pk, sk: item.sk },
        UpdateExpression:
          "SET #data.#started = :started, #data.#day = :day, #updated = :updated",
        ExpressionAttributeNames: {
          "#data": "data",
          "#started": "journeyStartedAt",
          "#day": "dayCount",
          "#updated": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":started": journeyStartedAt,
          ":day": 3,
          ":updated": new Date().toISOString(),
        },
      })
    );
    console.log(`migrated ${item.sk} -> day 3`);
  }

  console.log(
    JSON.stringify({
      tableName,
      region,
      totalPersonas: items.length,
      migrated: legacy.length,
      journeyStartedAt,
    })
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
