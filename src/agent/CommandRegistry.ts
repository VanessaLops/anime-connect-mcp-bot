import type { Command, CommandContext } from "./Command.js";
import type { BotSettings, GroupBots } from "../domain/botSettings.js";
import { hasPermission } from "./permissions.js";
import { isCommandEnabled } from "../domain/botSettings.js";

const COMMAND_PREFIX = "!";

/**
 * Guarda todos os comandos disponíveis e decide, pra cada mensagem, se ela
 * é um comando e se quem mandou tem permissão de executá-lo.
 */
export class CommandRegistry {
  private commands = new Map<string, Command>();

  register(command: Command): void {
    this.commands.set(command.trigger, command);
  }

  list(): Command[] {
    return [...this.commands.values()];
  }

  /**
   * Se `content` começa com o prefixo de comando (ex: "!ping"), tenta
   * executar. Retorna `true` se era um comando (executado ou negado),
   * `false` se a mensagem não era um comando, se o grupo não tem o bot dono
   * dele, ou se o dono desligou esse comando nesse grupo (`settings.commands`)
   * — nesses casos ele se comporta como se não existisse.
   */
  async tryDispatch(
    content: string,
    base: Omit<CommandContext, "args" | "settings">
  ): Promise<boolean> {
    if (!content.startsWith(COMMAND_PREFIX)) return false;

    const [rawTrigger, ...args] = content.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
    const command = this.commands.get(rawTrigger.toLowerCase());
    if (!command) return false;
    const settings = speakerFor(command, base.bots);
    if (!settings || !isCommandEnabled(command.trigger, settings)) return false;
    const ctx = { ...base, settings };

    if (!hasPermission(ctx.role, command.minRole)) {
      await ctx.actuator.sendMessage(
        ctx.message.channelId,
        `você não tem permissão para usar !${command.trigger}`,
        ctx.settings
      );
      return true;
    }

    await command.execute({ ...ctx, args });
    return true;
  }
}

/** Config do bot que responde ao comando — `undefined` se o grupo não tem esse bot. */
export function speakerFor(command: Command, bots: GroupBots): BotSettings | undefined {
  return command.bot === "any" ? bots.mod ?? bots.dj : bots[command.bot];
}
