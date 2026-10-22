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
import { DEFAULT_BOT_SETTINGS, DJ_BOT_SETTINGS } from "./domain/botSettings.js";
import type { GroupBots } from "./domain/botSettings.js";
import { MessageRepository } from "./storage/MessageRepository.js";
import { createMcpServer } from "./mcp/server.js";
import { CommandRegistry } from "./agent/CommandRegistry.js";
import { pingCommand } from "./agent/commands/ping.js";
import { makeHelpCommand } from "./agent/commands/help.js";
import { banCommand } from "./agent/commands/ban.js";
import { playCommand } from "./agent/commands/play.js";
import { queueCommand, skipCommand, stopCommand } from "./agent/commands/controls.js";
import { radioCommand, radiosCommand } from "./agent/commands/radio.js";
import type { ChatActuator } from "./actuation/ChatActuator.js";
import { DryRunActuator } from "./actuation/ChatActuator.js";
import { FirebaseActuator } from "./actuation/FirebaseActuator.js";
import type { Role } from "./agent/permissions.js";
import type { ChatMessage } from "./domain/types.js";
import { advance } from "./music/dj.js";

function buildCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();
  registry.register(pingCommand);
  registry.register(banCommand);
  registry.register(playCommand);
  registry.register(stopCommand);
  registry.register(skipCommand);
  registry.register(queueCommand);
  registry.register(radioCommand);
  registry.register(radiosCommand);
  registry.register(makeHelpCommand(registry));
  return registry;
}

/**
 * Dono do grupo vira "owner"; subdono, staff e a administração do app viram
 * "admin"; o resto é "member".
 */
async function resolveRole(message: ChatMessage, source: ChatSource): Promise<Role> {
  if (source instanceof FirebaseChatSource && message.channelId.startsWith("group:")) {
    const groupId = Number(message.channelId.split(":")[1]);
    const ownerId = await source.getGroupOwner(groupId);
    if (ownerId === message.authorId) return "owner";
    if (await source.isGroupAdmin(groupId, Number(message.authorId))) return "admin";
  }
  return "member";
}

/** Bots ligados no grupo da mensagem. Sem Firebase (dev), os dois respondem com a config padrão. */
async function resolveGroupBots(message: ChatMessage, source: ChatSource): Promise<GroupBots> {
  if (source instanceof FirebaseChatSource && message.channelId.startsWith("group:")) {
    const groupId = Number(message.channelId.split(":")[1]);
    return source.getGroupBots(groupId);
  }
  return { mod: DEFAULT_BOT_SETTINGS, dj: DJ_BOT_SETTINGS };
}

/**
 * Escolhe fonte e atuador de acordo com o `.env`:
 * - sem credenciais do Firebase -> tudo mockado, só pra desenvolvimento.
 * - com credenciais + DRY_RUN=true (padrão) -> lê o Firebase real, mas só loga as ações.
 * - com credenciais + DRY_RUN=false -> lê e ESCREVE no Firebase real; cada grupo ainda liga
 *   ou desliga a ação de verdade no próprio `bot_settings.active`.
 */
async function buildPipeline(repo: MessageRepository): Promise<{ source: ChatSource; actuator: ChatActuator }> {
  const { serviceAccountPath, databaseUrl } = config.firebase;
  if (!serviceAccountPath || !databaseUrl) {
    console.warn("Firebase não configurado (.env) — usando dados mockados.");
    return { source: new MockChatSource(), actuator: new DryRunActuator() };
  }

  const db: Database = getFirebaseDb(serviceAccountPath, databaseUrl);
  // retoma da última mensagem já processada; banco vazio = só o que chegar daqui pra frente
  const source = new FirebaseChatSource(db, repo.getLatestMessageAt() ?? new Date().toISOString());

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

    const bots = await resolveGroupBots(message, source);

    // Moderação é trabalho do moderador — grupo só com o DJ não é moderado.
    if (bots.mod) {
      const keywordHit = detectKeywordAlert(message, bots.mod.keywordAlerts);
      const capsHit = checkCaps(message.content);
      const badwordHit = checkBadwords(message.content, bots.mod.badwords);
      const reason = keywordHit ?? capsHit?.detail ?? badwordHit?.detail ?? null;
      if (reason) repo.saveAlert(message.id, reason);
    }

    // Cargo custa leituras no banco — só vale a pena pra quem mandou comando.
    if (!message.content.startsWith("!")) continue;
    const role = await resolveRole(message, source);
    await commands.tryDispatch(message.content, { message, role, actuator, bots });
  }
}

/**
 * Fila do bot DJ: quando o vídeo de um grupo termina (pela duração que o app
 * informou), toca a próxima pedida — ou encerra, se não tiver mais nada.
 */
async function advanceMusicQueues(source: ChatSource, actuator: ChatActuator): Promise<void> {
  if (!(source instanceof FirebaseChatSource)) return;
  for (const groupId of await source.getGroupsWithBotEnabled()) {
    const channelId = `group:${groupId}`;
    const next = advance(await actuator.getMusic(channelId), Date.now());
    if (!next) continue;
    const settings = (await source.getGroupBots(groupId)).dj;
    if (!settings?.active) continue;
    await actuator.setMusic(channelId, next, settings);
    if (next.now) {
      await actuator.sendMessage(channelId, `🎵 Tocando agora: ${next.now.title}\npedido por ${next.now.requested_by}`, settings);
    }
  }
}

const PRESENCE_INTERVAL_MS = 60_000;

/** Mantém cada usuário-bot (moderador e DJ) de cada grupo ativo como "online" na lista de membros do app. */
async function touchBotPresence(source: ChatSource, actuator: ChatActuator): Promise<void> {
  if (!(source instanceof FirebaseChatSource) || !(actuator instanceof FirebaseActuator)) return;
  for (const groupId of await source.getGroupsWithBotEnabled()) {
    for (const settings of Object.values(await source.getGroupBots(groupId))) {
      await actuator.touchPresence(groupId, settings);
    }
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
  const { source, actuator } = await buildPipeline(repo);
  const commands = buildCommandRegistry();

  // Em sequência, não em paralelo: os dois leem e regravam a fila de músicas,
  // e rodando juntos um pedido novo podia ser sobrescrito.
  setInterval(async () => {
    await pollOnce({ source, repo, commands, actuator }).catch((err) => {
      console.error("Erro no ciclo de polling:", err);
    });
    await advanceMusicQueues(source, actuator).catch((err) => {
      console.error("Erro ao avançar a fila de músicas:", err);
    });
  }, config.pollIntervalMs);

  const heartbeat = () =>
    touchBotPresence(source, actuator).catch((err) => {
      console.error("Erro ao marcar presença do bot:", err);
    });
  heartbeat();
  setInterval(heartbeat, PRESENCE_INTERVAL_MS);

  const server = createMcpServer(repo);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
