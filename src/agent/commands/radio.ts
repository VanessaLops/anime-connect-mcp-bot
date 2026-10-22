import type { Command } from "../Command.js";
import { findStations, topStations, type RadioStation } from "../../music/radio.js";
import { requestTrack } from "./music.js";

/** Última lista mostrada em cada grupo, pro `!radio 2` escolher dela. */
const lastResults = new Map<string, RadioStation[]>();

function formatList(stations: RadioStation[]): string {
  return stations.map((s, i) => `${i + 1}. ${s.name} (${s.country})`).join("\n");
}

/**
 * `!radio <nome ou gênero>` toca a mais votada e lista as outras;
 * `!radio <n>` pede a n-ésima da última lista (de `!radio` ou `!radios`).
 * Como o `!play`, entra na fila se já tiver algo tocando.
 */
export const radioCommand: Command = {
  trigger: "radio",
  description: "Toca (ou põe na fila) uma rádio: !radio <nome ou gênero> | !radio <número da lista>",
  minRole: "admin",
  bot: "dj",
  async execute(ctx) {
    const { message, actuator, settings, args } = ctx;
    const query = args.join(" ").trim();
    if (!query) {
      await actuator.sendMessage(message.channelId, "use: !radio <nome ou gênero>, ex: !radio antena 1, !radio anime", settings);
      return;
    }

    let station: RadioStation | undefined;
    let others = "";
    if (/^\d+$/.test(query)) {
      station = lastResults.get(message.channelId)?.[Number(query) - 1];
      if (!station) {
        await actuator.sendMessage(message.channelId, "não tenho essa opção — busque antes com !radio <nome> ou !radios", settings);
        return;
      }
    } else {
      const found = await findStations(query).catch(() => null);
      if (found === null) {
        await actuator.sendMessage(message.channelId, "o catálogo de rádios não respondeu, tenta de novo daqui a pouco", settings);
        return;
      }
      if (!found.length) {
        await actuator.sendMessage(message.channelId, `não achei rádio pra "${query}" 😕`, settings);
        return;
      }
      lastResults.set(message.channelId, found);
      station = found[0];
      if (found.length > 1) others = `\n\noutras opções (!radio <número>):\n${formatList(found)}`;
    }

    await requestTrack(
      ctx,
      {
        kind: "radio",
        stream_url: station.stream_url,
        title: station.name,
        country: station.country,
        favicon: station.favicon,
        requested_by: message.authorName,
        started_at: new Date().toISOString(),
      },
      `📻 Rádio no ar: ${station.name} (${station.country})\npedido por ${message.authorName}${others}`
    );
  },
};

/** `!radios [país]` — as mais votadas do país (padrão BR), numeradas pro `!radio <n>`. */
export const radiosCommand: Command = {
  trigger: "radios",
  description: "Rádios mais populares de um país: !radios [br|jp|us|...]",
  minRole: "member",
  bot: "dj",
  async execute({ message, actuator, settings, args }) {
    const country = (args[0] ?? "br").toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      await actuator.sendMessage(message.channelId, "use o código do país com 2 letras, ex: !radios br, !radios jp", settings);
      return;
    }

    const found = await topStations(country, 8).catch(() => null);
    if (!found?.length) {
      await actuator.sendMessage(message.channelId, found ? `não achei rádios pra ${country}` : "o catálogo de rádios não respondeu", settings);
      return;
    }
    lastResults.set(message.channelId, found);
    await actuator.sendMessage(message.channelId, `📻 Rádios populares (${country}) — toque com !radio <número>:\n${formatList(found)}`, settings);
  },
};
