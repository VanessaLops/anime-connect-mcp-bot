import type { Command } from "../Command.js";

export const pingCommand: Command = {
  trigger: "ping",
  description: "Verifica se o bot está online",
  minRole: "member",
  async execute({ message, actuator, settings }) {
    await actuator.sendMessage(message.channelId, settings.commands.ping.message, settings);
  },
};
