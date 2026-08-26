import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const keyPath = process.argv[2];
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
const url = `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;

initializeApp({ credential: cert(serviceAccount), databaseURL: url });
const db = getDatabase();

const groups = (await db.ref("groups").get()).val();
console.log("=== groups ===");
console.log(JSON.stringify(groups, null, 2));

const messages = (await db.ref("group_messages").get()).val();
console.log("\n=== group_messages (últimas 5) ===");
const msgList = Object.values(messages ?? {});
console.log(JSON.stringify(msgList.slice(-5), null, 2));

const users = (await db.ref("users").get()).val();
console.log("\n=== usuários com is_bot ===");
const bots = Object.values(users ?? {}).filter((u) => u.is_bot);
console.log(JSON.stringify(bots, null, 2));

process.exit(0);
