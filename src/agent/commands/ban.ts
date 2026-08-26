import type { Command } from "../Command.js";

/**
 * Stub: uso é "!ban <userId> <motivo>". Só admin/dono podem chamar.
 * A ação de fato passa pelo actuator (hoje em dry-run, ver src/actuation).
 */
export const banCommand: Command = {
  trigger: "ban",
  description: "Bane um usuário do grupo (uso: !ban <userId> <motivo>)",
  minRole: "admin",
  async execute({ message, args, actuator, settings }) {
    const [userId, ...reasonParts] = args;
    if (!userId) {
      await actuator.sendMessage(message.channelId, "uso: !ban <userId> <motivo>", settings);
      return;
    }
    await actuator.banUser(message.channelId, userId, reasonParts.join(" ") || "sem motivo", settings);
  },
};
