export interface ModerationHit {
  rule: "caps" | "flood" | "badword";
  detail: string;
}

/** Mensagem em CAPS LOCK (mais de `minLength` letras e >70% maiúsculas). */
export function checkCaps(content: string, minLength = 8): ModerationHit | null {
  const letters = content.replace(/[^a-zA-Z]/g, "");
  if (letters.length < minLength) return null;
  const upper = letters.replace(/[^A-Z]/g, "");
  return upper.length / letters.length > 0.7
    ? { rule: "caps", detail: "mensagem em caps lock" }
    : null;
}

/** Flood: o mesmo autor mandou `threshold`+ mensagens iguais/seguidas recentemente. */
export function checkFlood(
  recentContentsFromSameAuthor: string[],
  threshold = 3
): ModerationHit | null {
  if (recentContentsFromSameAuthor.length < threshold) return null;
  const last = recentContentsFromSameAuthor.slice(-threshold);
  const allEqual = last.every((c) => c === last[0]);
  return allEqual ? { rule: "flood", detail: `${threshold}x a mesma mensagem seguida` } : null;
}

/** Palavra da lista de banidas presente no conteúdo. */
export function checkBadwords(content: string, badwords: string[]): ModerationHit | null {
  const lower = content.toLowerCase();
  const hit = badwords.find((w) => lower.includes(w));
  return hit ? { rule: "badword", detail: `palavra banida: "${hit}"` } : null;
}
