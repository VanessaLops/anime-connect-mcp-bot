import type { ChatMessage } from "./types.js";

/**
 * Verifica se o conteúdo da mensagem contém alguma palavra-chave da lista
 * de vigilância (ex: "spam", "golpe"). Retorna o motivo do alerta (texto
 * pronto pra salvar/exibir) ou `null` se a mensagem não bateu com nada.
 */
export function detectKeywordAlert(
  message: ChatMessage,
  keywords: string[]
): string | null {
  const content = message.content.toLowerCase();
  const hit = keywords.find((k) => content.includes(k));
  return hit ? `palavra-chave suspeita: "${hit}"` : null;
}
