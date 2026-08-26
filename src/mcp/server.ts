import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MessageRepository } from "../storage/MessageRepository.js";

/**
 * Monta o servidor MCP e registra as 3 tools que um cliente de IA (Claude)
 * pode chamar pra consultar o que foi monitorado no chat. Cada tool aqui
 * é só uma "porta de entrada" que delega a leitura pro `MessageRepository`.
 */
export function createMcpServer(repo: MessageRepository): McpServer {
  const server = new McpServer({
    name: "anime-connect-chat-monitor",
    version: "0.1.0",
  });

  // Tool: devolve as N mensagens mais recentes do chat monitorado.
  server.tool(
    "get_recent_messages",
    "Retorna as mensagens mais recentes do chat monitorado",
    { limit: z.number().int().min(1).max(100).default(20) },
    async ({ limit }) => ({
      content: [
        { type: "text", text: JSON.stringify(repo.getRecentMessages(limit), null, 2) },
      ],
    })
  );

  // Tool: procura mensagens que contenham um termo específico.
  server.tool(
    "search_messages",
    "Busca mensagens do chat que contenham um termo",
    {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async ({ query, limit }) => ({
      content: [
        { type: "text", text: JSON.stringify(repo.searchMessages(query, limit), null, 2) },
      ],
    })
  );

  // Tool: devolve os alertas mais recentes (palavras-chave suspeitas detectadas).
  server.tool(
    "get_recent_alerts",
    "Retorna os alertas mais recentes gerados pelo monitoramento (spam, palavras-chave, etc)",
    { limit: z.number().int().min(1).max(100).default(20) },
    async ({ limit }) => ({
      content: [
        { type: "text", text: JSON.stringify(repo.getRecentAlerts(limit), null, 2) },
      ],
    })
  );

  return server;
}
