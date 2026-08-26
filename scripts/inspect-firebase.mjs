import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const keyPath = process.argv[2];
if (!keyPath) {
  console.error("uso: node scripts/inspect-firebase.mjs <caminho-para-service-account.json>");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

console.log(`Projeto: ${serviceAccount.project_id}`);
console.log("Tentando listar coleções raiz do Firestore...\n");

try {
  const collections = await db.listCollections();
  if (collections.length === 0) {
    console.log("Nenhuma coleção encontrada na raiz do Firestore.");
  }
  for (const col of collections) {
    console.log(`Coleção: ${col.id}`);
    const snapshot = await col.limit(2).get();
    snapshot.forEach((doc) => {
      console.log(`  doc ${doc.id}:`, JSON.stringify(doc.data()).slice(0, 300));
    });
    console.log("");
  }
} catch (err) {
  console.error("Erro ao acessar Firestore:", err.message);
}

process.exit(0);
