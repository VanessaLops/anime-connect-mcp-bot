import type { ChatMessage } from "../domain/types.js";
import type { ChatActuator } from "../actuation/ChatActuator.js";
import type { Role } from "./permissions.js";
import type { BotKind, BotSettings, GroupBots } from "../domain/botSettings.js";

export interface CommandContext {
  message: ChatMessage;
  role: Role;
  args: string[];
  actuator: ChatActuator;
  /** Config do bot que responde a este comando. */
  settings: BotSettings;
  /** Todos os bots ligados no grupo (o `!help` lista só os comandos deles). */
  bots: GroupBots;
}

export interface Command {
  /** Palavra que ativa o comando, ex: "ping" para a mensagem "!ping". */
  trigger: string;
  description: string;
  /** Papel mínimo necessário pra executar (owner/admin/member). */
  minRole: Role;
  /**
   * Qual bot responde. Grupo sem esse bot ignora o comando. `"any"` = comando
   * comum aos dois: responde o moderador, ou o DJ se ele estiver sozinho.
   */
  bot: BotKind | "any";
  execute(ctx: CommandContext): Promise<void>;
}
