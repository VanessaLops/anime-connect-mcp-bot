import type { NowPlaying } from "./youtube.js";

/** Tudo que o bot DJ grava em `groups/{id}/music`: o que toca agora e a fila de pedidos. */
export interface MusicState {
  now: NowPlaying | null;
  queue: NowPlaying[];
}

export const EMPTY_MUSIC: MusicState = { now: null, queue: [] };

/**
 * Já acabou? Só dá pra saber de vídeo cuja duração o app informou
 * (`duration`, gravado pelo primeiro player que carregou).
 */
export function hasEnded(track: NowPlaying, nowMs: number): boolean {
  if (track.kind !== "youtube" || !track.duration) return false;
  return Date.parse(track.started_at) + track.duration * 1000 <= nowMs;
}

/**
 * Hora de passar a vez: silêncio com fila, vídeo que terminou, ou rádio com
 * alguém esperando — rádio é ao vivo e nunca acaba, então cede a vez.
 * `null` = nada muda, não precisa gravar.
 */
export function advance(state: MusicState, nowMs: number): MusicState | null {
  const { now, queue } = state;
  const turnOver = !now ? queue.length > 0 : now.kind === "radio" ? queue.length > 0 : hasEnded(now, nowMs);
  return turnOver ? skip(state, nowMs) : null;
}

/** Pedido novo vai pro fim da fila — e já toca se o chat estiver livre. `position` 0 = tocando agora. */
export function enqueue(state: MusicState, track: NowPlaying, nowMs: number): { state: MusicState; position: number } {
  const queued = { now: state.now, queue: [...state.queue, track] };
  const next = advance(queued, nowMs) ?? queued;
  return { state: next, position: next.queue.indexOf(track) + 1 };
}

/** Passa pra próxima da fila (ou silêncio, se ela está vazia). */
export function skip(state: MusicState, nowMs: number): MusicState {
  const [next, ...rest] = state.queue;
  return { now: next ? restart(next, nowMs) : null, queue: rest };
}

/** O relógio de quem esperou na fila começa quando ela de fato entra no ar. */
function restart(track: NowPlaying, nowMs: number): NowPlaying {
  return { ...track, started_at: new Date(nowMs).toISOString() };
}
