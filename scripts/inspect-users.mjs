import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const keyPath = process.argv[2];
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
const url = `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;

initializeApp({ credential: cert(serviceAccount), databaseURL: url });
const db = getDatabase();

const snap = await db.ref("users").limitToFirst(3).get();
const val = snap.val();
for (const entry of val) {
  if (!entry) continue;
  const { avatar_url, ...rest } = entry;
  console.log(rest);
}
process.exit(0);
