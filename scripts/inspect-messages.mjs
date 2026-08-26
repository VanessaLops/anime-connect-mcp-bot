import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const keyPath = process.argv[2];
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
const url = `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;

initializeApp({ credential: cert(serviceAccount), databaseURL: url });
const db = getDatabase();

for (const path of ["direct_messages", "group_messages", "groups", "users"]) {
  const snap = await db.ref(path).limitToFirst(3).get();
  console.log(`\n=== ${path} ===`);
  console.log(snap.exists() ? JSON.stringify(snap.val(), null, 2).slice(0, 1500) : "vazio");
}

process.exit(0);
