import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";

let dbInstance: Database | null = null;

/** Inicializa (uma única vez) e retorna a conexão com o Realtime Database. */
export function getFirebaseDb(serviceAccountPath: string, databaseUrl: string): Database {
  if (dbInstance) return dbInstance;
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
  const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount), databaseURL: databaseUrl });
  dbInstance = getDatabase(app);
  return dbInstance;
}
