import type { ChatMessage } from "../domain/types.js";
import type { ChatActuator } from "../actuation/ChatActuator.js";
import type { Role } from "./permissions.js";
import type { BotSettings } from "../domain/botSettings.js";

export interface CommandContext {
  message: ChatMessage;
  role: Role;
  args: string[];
  actuator: ChatActuator;
  settings: BotSettings;
}

export interface Command {
  /** Palavra que ativa o comando, ex: "ping" para a mensagem "!ping". */
  trigger: string;
  description: string;
  /** Papel mínimo necessário pra executar (owner/admin/member). */
  minRole: Role;
  execute(ctx: CommandContext): Promise<void>;
}
