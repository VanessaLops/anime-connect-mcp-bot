export const config = {
  dbPath: process.env.DB_PATH ?? "./data/chat.db",
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
  keywordAlerts: (process.env.KEYWORD_ALERTS ?? "spam,golpe,scam")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean),
  badwords: (process.env.BADWORDS ?? "golpe,scam")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean),
  firebase: {
    // Caminho do arquivo de credencial baixado no console do Firebase.
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? "",
    databaseUrl: process.env.FIREBASE_DATABASE_URL ?? "",
  },
  // Enquanto true, o bot só loga as ações que tomaria (não escreve no Firebase real).
  dryRun: (process.env.DRY_RUN ?? "true") === "true",
};
