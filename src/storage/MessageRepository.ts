import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { ChatMessage, Alert } from "../domain/types.js";

export class MessageRepository {
  private db: Database.Database;

  /** Abre (ou cria) o arquivo SQLite em `dbPath` e garante que as tabelas existam. */
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channelId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        authorName TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        messageId TEXT NOT NULL,
        reason TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
  }

  /** Grava uma mensagem no banco. `INSERT OR IGNORE` evita duplicar se o `id` já existir. */
  saveMessage(message: ChatMessage): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO messages (id, channelId, authorId, authorName, content, createdAt)
         VALUES (@id, @channelId, @authorId, @authorName, @content, @createdAt)`
      )
      .run(message);
  }

  /** Cria e persiste um alerta associado a uma mensagem (ex: quando bate uma palavra-chave). */
  saveAlert(messageId: string, reason: string): Alert {
    const alert: Alert = {
      id: randomUUID(),
      messageId,
      reason,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO alerts (id, messageId, reason, createdAt) VALUES (@id, @messageId, @reason, @createdAt)`
      )
      .run(alert);
    return alert;
  }

  /** `createdAt` da mensagem mais nova já gravada, ou `null` se o banco está vazio. */
  getLatestMessageAt(): string | null {
    const row = this.db.prepare(`SELECT MAX(createdAt) AS latest FROM messages`).get() as { latest: string | null };
    return row.latest;
  }

  /** Retorna as últimas `limit` mensagens, mais recentes primeiro. */
  getRecentMessages(limit: number): ChatMessage[] {
    return this.db
      .prepare(`SELECT * FROM messages ORDER BY createdAt DESC LIMIT ?`)
      .all(limit) as ChatMessage[];
  }

  /** Busca mensagens cujo conteúdo contenha `query` (LIKE case-insensitive por padrão do SQLite). */
  searchMessages(query: string, limit: number): ChatMessage[] {
    return this.db
      .prepare(
        `SELECT * FROM messages WHERE content LIKE ? ORDER BY createdAt DESC LIMIT ?`
      )
      .all(`%${query}%`, limit) as ChatMessage[];
  }

  /** Retorna os últimos `limit` alertas gerados pelas regras de monitoramento. */
  getRecentAlerts(limit: number): Alert[] {
    return this.db
      .prepare(`SELECT * FROM alerts ORDER BY createdAt DESC LIMIT ?`)
      .all(limit) as Alert[];
  }
}
