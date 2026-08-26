import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Database } from "firebase-admin/database";
import { config } from "./config/env.js";
import { getFirebaseDb } from "./firebase/client.js";
import { MockChatSource } from "./ingestion/MockChatSource.js";
import { FirebaseChatSource } from "./ingestion/FirebaseChatSource.js";
import type { ChatSource } from "./ingestion/ChatSource.js";
import { detectKeywordAlert } from "./domain/rules.js";
import { checkCaps, checkBadwords } from "./domain/moderation/filters.js";
import { DEFAULT_BOT_SETTINGS } from "./domain/botSettings.js";
import type { BotSettings } from "./domain/botSettings.js";
import { MessageRepository } from "./storage/MessageRepository.js";
import { createMcpServer } from "./mcp/server.js";
import { CommandRegistry } from "./agent/CommandRegistry.js";
import { pingCommand } from "./agent/commands/ping.js";
import { makeHelpCommand } from "./agent/commands/help.js";
import { banCommand } from "./agent/commands/ban.js";
import type { ChatActuator } from "./actuation/ChatActuator.js";
import { DryRunActuator } from "./actuation/ChatActuator.js";
import { FirebaseActuator } from "./actuation/FirebaseActuator.js";
import type { Role } from "./agent/permissions.js";
import type { ChatMessage } from "./domain/types.js";

function buildCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();
  registry.register(pingCommand);
  registry.register(banCommand);
  registry.register(makeHelpCommand(registry));
  return registry;
}

/** Owner do grupo vira "owner"; qualquer outro autor é tratado como "member" (admins ainda não mapeados). */
async function resolveRole(message: ChatMessage, source: ChatSource): Promise<Role> {
  if (source instanceof FirebaseChatSource && message.channelId.startsWith("group:")) {
    const groupId = Number(message.channelId.split(":")[1]);
    const ownerId = await source.getGroupOwner(groupId);
    if (ownerId === message.authorId) return "owner";
  }
  return "member";
}

/**
 * Config do bot pro grupo da mensagem — vem de `groups/{id}/bot_settings`
 * (o dono personaliza pelo app), com defaults pra quem ainda não mexeu nisso.
 */
async function resolveBotSettings(message: ChatMessage, source: ChatSource): Promise<BotSettings> {
  if (source instanceof FirebaseChatSource && message.channelId.startsWith("group:")) {
    const groupId = Number(message.channelId.split(":")[1]);
    return source.getBotSettings(groupId);
  }
  return DEFAULT_BOT_SETTINGS;
}

/**
 * Escolhe fonte e atuador de acordo com o `.env`:
 * - sem credenciais do Firebase -> tudo mockado, só pra desenvolvimento.
 * - com credenciais + DRY_RUN=true (padrão) -> lê o Firebase real, mas só loga as ações.
 * - com credenciais + DRY_RUN=false -> lê e ESCREVE no Firebase real; cada grupo ainda liga
 *   ou desliga a ação de verdade no próprio `bot_settings.active`.
 */
async function buildPipeline(): Promise<{ source: ChatSource; actuator: ChatActuator }> {
  const { serviceAccountPath, databaseUrl } = config.firebase;
  if (!serviceAccountPath || !databaseUrl) {
    console.warn("Firebase não configurado (.env) — usando dados mockados.");
    return { source: new MockChatSource(), actuator: new DryRunActuator() };
  }

  const db: Database = getFirebaseDb(serviceAccountPath, databaseUrl);
  const source = new FirebaseChatSource(db);

  if (config.dryRun) {
    console.log("Firebase real conectado. DRY_RUN=true — o bot só vai logar as ações, sem escrever.");
    return { source, actuator: new DryRunActuator() };
  }

  console.log(
    "Firebase real conectado. DRY_RUN=false — bot pronto; identidade e ativação seguem o bot_settings de cada grupo."
  );
  return { source, actuator: new FirebaseActuator(db) };
}

interface PollDeps {
  source: ChatSource;
  repo: MessageRepository;
  commands: CommandRegistry;
  actuator: ChatActuator;
}

/** Um ciclo de: buscar mensagens novas -> moderar -> despachar comando -> persistir. */
async function pollOnce({ source, repo, commands, actuator }: PollDeps): Promise<void> {
  const messages = await source.fetchNewMessages();
  for (const message of messages) {
    repo.saveMessage(message);

    // evita o bot reagir a mensagens de qualquer usuário-bot, inclusive ele mesmo
    // (ex: a resposta de !help lista "!ping..." e viraria loop se fosse reprocessada)
    if (source instanceof FirebaseChatSource && (await source.isBotUser(Number(message.authorId)))) {
      continue;
    }

    const settings = await resolveBotSettings(message, source);

    const keywordHit = detectKeywordAlert(message, settings.keywordAlerts);
    const capsHit = checkCaps(message.content);
    const badwordHit = checkBadwords(message.content, settings.badwords);
    const reason = keywordHit ?? capsHit?.detail ?? badwordHit?.detail ?? null;
    if (reason) repo.saveAlert(message.id, reason);

    const role = await resolveRole(message, source);
    await commands.tryDispatch(message.content, { message, role, actuator, settings });
  }
}

/**
 * Ponto de entrada: liga todas as camadas.
 * 1. Abre o repositório (storage) e monta a fonte de mensagens + atuador (ingestion/actuation).
 * 2. A cada intervalo: busca mensagens novas, ignora as de qualquer bot, roda
 *    moderação (domain) com o bot_settings do grupo, tenta despachar como
 *    comando (agent) e persiste tudo (storage).
 * 3. Sobe o servidor MCP (via stdio) expondo o histórico como tools.
 */
async function main() {
  const repo = new MessageRepository(config.dbPath);
  const { source, actuator } = await buildPipeline();
  const commands = buildCommandRegistry();

  setInterval(() => {
    pollOnce({ source, repo, commands, actuator }).catch((err) => {
      console.error("Erro no ciclo de polling:", err);
    });
  }, config.pollIntervalMs);

  const server = createMcpServer(repo);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
