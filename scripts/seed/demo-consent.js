/**
 * Demo children start already consented, so the legal-guardian consent gate
 * (src/backend/features/consent) never blocks the demo cohort.
 *
 * Writes the same row shape as createMapStore("child-consent.json"):
 *   PERSISTENCE=dynamodb → pk=MAP#child-consent, sk=<childUserId>, data=<state>
 *   PERSISTENCE=json     → .data/child-consent.json
 */
const fs = require("fs");
const path = require("path");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");

/** Keep in sync with CONSENT_VERSION in src/backend/features/consent/consent.types.ts */
const CONSENT_VERSION = "2026-10-22";

function demoConsentState(childUserId, at) {
  return {
    childUserId,
    ageBand: "14plus",
    status: "granted",
    basis: "self",
    selfConsent: {
      items: { privacyCollection: true, sensitiveData: true },
      consentVersion: CONSENT_VERSION,
      consentedAt: at,
    },
    createdAt: at,
    updatedAt: at,
  };
}

async function seedDemoConsent({ doc, table, childUserIds }) {
  const at = new Date().toISOString();
  const persistence = (process.env.PERSISTENCE || "json").trim().toLowerCase();

  if (persistence === "dynamodb") {
    for (const id of childUserIds) {
      await doc.send(
        new PutCommand({
          TableName: table,
          Item: {
            pk: "MAP#child-consent",
            sk: id,
            data: demoConsentState(id, at),
            updatedAt: at,
          },
        })
      );
      console.log(`consented ${id} (demo)`);
    }
    return;
  }

  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "child-consent.json");
  let current = {};
  try {
    if (fs.existsSync(file)) current = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    current = {};
  }
  for (const id of childUserIds) current[id] = demoConsentState(id, at);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(current, null, 2), "utf8");
  console.log(`consented ${childUserIds.length} demo children → ${file}`);
}

module.exports = { seedDemoConsent, demoConsentState, CONSENT_VERSION };
