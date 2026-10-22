/**
 * O que está tocando no grupo — gravado em `groups/{id}/music/now`. Vídeo do
 * YouTube o app sincroniza por `started_at`; rádio já é ao vivo pra todo mundo.
 * `duration` (segundos) quem grava é o app, quando o player carrega — é como
 * o bot sabe a hora de tocar a próxima da fila.
 */
export type NowPlaying =
  | { kind: "youtube"; video_id: string; title: string; requested_by: string; started_at: string; duration?: number }
  | { kind: "radio"; stream_url: string; title: string; country: string; favicon: string; requested_by: string; started_at: string };

const YOUTUBE_ID =
  /(?:youtube\.com\/(?:watch\?(?:\S*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/i;

/** Id do vídeo de um link do YouTube (watch, youtu.be, shorts, music), ou `null`. */
export function parseYouTubeId(url: string): string | null {
  return url.match(YOUTUBE_ID)?.[1] ?? null;
}

/**
 * Título via oEmbed (não precisa de chave). `null` quando o vídeo não existe
 * ou o dono bloqueou tocar fora do YouTube — aí o player do app também não tocaria.
 * A duração não dá pra pegar daqui: o YouTube pede login pra IPs de datacenter.
 */
export async function fetchVideoTitle(videoId: string): Promise<string | null> {
  const url = `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${videoId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return data.title ?? "música";
  } catch {
    return "música";
  }
}
