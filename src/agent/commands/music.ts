import type { CommandContext } from "../Command.js";
import type { NowPlaying } from "../../music/youtube.js";
import { enqueue } from "../../music/dj.js";

/**
 * Pedido de `!play`/`!radio`: entra na fila e o chat fica sabendo se já está
 * tocando (`playingText`) ou em que lugar da fila ficou.
 */
export async function requestTrack(
  { message, actuator, settings }: Pick<CommandContext, "message" | "actuator" | "settings">,
  track: NowPlaying,
  playingText: string
): Promise<void> {
  const { state, position } = enqueue(await actuator.getMusic(message.channelId), track, Date.now());
  await actuator.setMusic(message.channelId, state, settings);
  const text = position === 0 ? playingText : `📝 Na fila (#${position}): ${track.title}\npedido por ${track.requested_by}`;
  await actuator.sendMessage(message.channelId, text, settings);
}
