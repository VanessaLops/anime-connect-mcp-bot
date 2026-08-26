import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const keyPath = process.argv[2];
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
const projectId = serviceAccount.project_id;

const candidateUrls = [
  `https://${projectId}-default-rtdb.firebaseio.com`,
  `https://${projectId}-default-rtdb.europe-west1.firebasedatabase.app`,
  `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`,
  `https://${projectId}.firebaseio.com`,
];

for (const url of candidateUrls) {
  try {
    const app = initializeApp(
      { credential: cert(serviceAccount), databaseURL: url },
      url
    );
    const db = getDatabase(app);
    const snapshot = await db.ref("/").limitToFirst(50).get();
    console.log(`\nURL: ${url}`);
    if (snapshot.exists()) {
      const val = snapshot.val();
      console.log("Chaves raiz encontradas:", Object.keys(val));
      console.log(JSON.stringify(val).slice(0, 500));
    } else {
      console.log("Conectou, mas raiz vazia.");
    }
  } catch (err) {
    console.log(`\nURL: ${url} -> erro: ${err.message}`);
  }
}

process.exit(0);
