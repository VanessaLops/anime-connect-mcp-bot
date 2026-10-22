import type { Command } from "../Command.js";
import { fetchVideoTitle, parseYouTubeId } from "../../music/youtube.js";
import { requestTrack } from "./music.js";

/**
 * Bot DJ: pede uma música pro grupo — toca na hora se nada estiver tocando,
 * senão entra na fila. O app de quem está no chat toca dentro do próprio
 * chat, a partir do ponto atual (`started_at`) — quem sai do chat para de
 * ouvir, mas a música segue pros outros.
 */
export const playCommand: Command = {
  trigger: "play",
  description: "Toca (ou põe na fila) uma música do YouTube: !play <link>",
  minRole: "admin",
  bot: "dj",
  async execute(ctx) {
    const { message, actuator, settings, args } = ctx;
    const videoId = parseYouTubeId(args[0] ?? "");
    if (!videoId) {
      await actuator.sendMessage(message.channelId, "use: !play <link do YouTube>", settings);
      return;
    }

    const title = await fetchVideoTitle(videoId);
    if (!title) {
      await actuator.sendMessage(message.channelId, "esse vídeo não existe ou não pode tocar fora do YouTube 😕", settings);
      return;
    }

    await requestTrack(
      ctx,
      { kind: "youtube", video_id: videoId, title, requested_by: message.authorName, started_at: new Date().toISOString() },
      `🎵 Tocando agora: ${title}\npedido por ${message.authorName}`
    );
  },
};
