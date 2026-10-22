import type { Command } from "../Command.js";
import { EMPTY_MUSIC, skip } from "../../music/dj.js";

/** Encerra o som na hora — música ou rádio — e limpa a fila de pedidos. */
export const stopCommand: Command = {
  trigger: "stop",
  description: "Encerra a música ou rádio do chat e limpa a fila",
  minRole: "admin",
  bot: "dj",
  async execute({ message, actuator, settings }) {
    await actuator.setMusic(message.channelId, EMPTY_MUSIC, settings);
    await actuator.sendMessage(message.channelId, "⏹️ som encerrado", settings);
  },
};

/** Corta o que está tocando e já põe a próxima da fila. */
export const skipCommand: Command = {
  trigger: "pular",
  description: "Pula pra próxima música da fila",
  minRole: "admin",
  bot: "dj",
  async execute({ message, actuator, settings }) {
    const state = skip(await actuator.getMusic(message.channelId), Date.now());
    await actuator.setMusic(message.channelId, state, settings);
    const text = state.now ? `⏭️ Tocando agora: ${state.now.title}\npedido por ${state.now.requested_by}` : "⏹️ fila vazia, som encerrado";
    await actuator.sendMessage(message.channelId, text, settings);
  },
};

/** Quem quiser pode ver o que vem a seguir. */
export const queueCommand: Command = {
  trigger: "fila",
  description: "Mostra o que está tocando e a fila de pedidos",
  minRole: "member",
  bot: "dj",
  async execute({ message, actuator, settings }) {
    const { now, queue } = await actuator.getMusic(message.channelId);
    if (!now && !queue.length) {
      await actuator.sendMessage(message.channelId, "nada tocando e fila vazia", settings);
      return;
    }
    const lines = [`▶️ ${now ? now.title : "(nada)"}`, ...queue.map((t, i) => `${i + 1}. ${t.title} — ${t.requested_by}`)];
    await actuator.sendMessage(message.channelId, lines.join("\n"), settings);
  },
};
