import type { Command } from "../Command.js";
import { speakerFor, type CommandRegistry } from "../CommandRegistry.js";
import { isCommandEnabled } from "../../domain/botSettings.js";

/** Fábrica porque o comando precisa enxergar os outros já registrados. */
export function makeHelpCommand(registry: CommandRegistry): Command {
  return {
    trigger: "help",
    description: "Lista os comandos disponíveis",
    minRole: "member",
    bot: "any",
    async execute({ message, actuator, settings, bots }) {
      // Só o que algum bot do grupo responde de fato — cada comando com a config do bot dele.
      const lines = registry
        .list()
        .filter((c) => {
          const speaker = speakerFor(c, bots);
          return !!speaker && isCommandEnabled(c.trigger, speaker);
        })
        .map((c) => `!${c.trigger} (${c.minRole}) — ${c.description}`);
      await actuator.sendMessage(message.channelId, lines.join("\n"), settings);
    },
  };
}
