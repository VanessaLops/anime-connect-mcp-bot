import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const [keyPath, groupId] = process.argv.slice(2);
if (!keyPath || !groupId) {
  console.error("uso: node scripts/enable-bot-settings.mjs <service-account.json> <groupId>");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
const url = `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;
initializeApp({ credential: cert(serviceAccount), databaseURL: url });
const db = getDatabase();

await db.ref(`groups/${groupId}/bot_settings/active`).set(true);
console.log(`groups/${groupId}/bot_settings/active = true`);
process.exit(0);
