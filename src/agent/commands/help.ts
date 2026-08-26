import type { Command } from "../Command.js";
import type { CommandRegistry } from "../CommandRegistry.js";
import { isCommandEnabled } from "../../domain/botSettings.js";

/** Fábrica porque o comando precisa enxergar os outros já registrados. */
export function makeHelpCommand(registry: CommandRegistry): Command {
  return {
    trigger: "help",
    description: "Lista os comandos disponíveis",
    minRole: "member",
    async execute({ message, actuator, settings }) {
      const lines = registry
        .list()
        .filter((c) => isCommandEnabled(c.trigger, settings))
        .map((c) => `!${c.trigger} (${c.minRole}) — ${c.description}`);
      await actuator.sendMessage(message.channelId, lines.join("\n"), settings);
    },
  };
}
