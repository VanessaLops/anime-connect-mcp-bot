/**
 * Busca de rádios na Radio Browser (radio-browser.info): API pública, sem
 * chave, ~60 mil estações do mundo todo. Só devolve stream https — iOS,
 * Android e a versão web do app bloqueiam áudio por http puro.
 */
const API = "https://all.api.radio-browser.info/json";
const HEADERS = { "User-Agent": "AnimeConnectBot/0.1" };

export interface RadioStation {
  name: string;
  stream_url: string;
  country: string;
  favicon: string;
}

interface RawStation {
  name: string;
  url_resolved: string;
  countrycode: string;
  favicon: string;
}

async function search(params: Record<string, string>, limit: number): Promise<RadioStation[]> {
  const qs = new URLSearchParams({ ...params, hidebroken: "true", order: "votes", reverse: "true", limit: "60" });
  const res = await fetch(`${API}/stations/search?${qs}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Radio Browser respondeu ${res.status}`);
  const rows = (await res.json()) as RawStation[];

  const seen = new Set<string>();
  const stations: RadioStation[] = [];
  for (const r of rows) {
    const name = r.name.trim();
    if (!r.url_resolved.startsWith("https://") || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    stations.push({ name, stream_url: r.url_resolved, country: r.countrycode, favicon: r.favicon });
    if (stations.length === limit) break;
  }
  return stations;
}

/**
 * Procura pelo nome da rádio; se nada bater, tenta como gênero (tag), ex: "anime", "rock".
 * No nome, as brasileiras vêm primeiro ("antena 1" é a de SP, não a de Portugal).
 */
export async function findStations(query: string, limit = 5): Promise<RadioStation[]> {
  const byName = await search({ name: query }, limit);
  if (!byName.length) return search({ tag: query.toLowerCase() }, limit);
  return byName.sort((a, b) => Number(b.country === "BR") - Number(a.country === "BR"));
}

/** Mais votadas de um país (código de 2 letras, ex: BR, JP, US). */
export async function topStations(countryCode: string, limit = 5): Promise<RadioStation[]> {
  return search({ countrycode: countryCode.toUpperCase() }, limit);
}
