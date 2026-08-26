import type { Command, CommandContext } from "./Command.js";
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
   * `false` se a mensagem não era um comando ou se o dono desligou esse
   * comando nesse grupo (`settings.commands`) — nesse caso ele se comporta
   * como se não existisse.
   */
  async tryDispatch(
    content: string,
    ctx: Omit<CommandContext, "args">
  ): Promise<boolean> {
    if (!content.startsWith(COMMAND_PREFIX)) return false;

    const [rawTrigger, ...args] = content.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
    const command = this.commands.get(rawTrigger.toLowerCase());
    if (!command) return false;
    if (!isCommandEnabled(command.trigger, ctx.settings)) return false;

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
