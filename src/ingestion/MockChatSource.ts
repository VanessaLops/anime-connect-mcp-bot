import { randomUUID } from "node:crypto";
import type { ChatSource } from "./ChatSource.js";
import type { ChatMessage } from "../domain/types.js";

/**
 * Fonte de dados de exemplo, só para validar o pipeline ponta a ponta.
 * Trocar por uma implementação real (API/webhook do app Anime Connect)
 * quando a integração estiver definida.
 */
export class MockChatSource implements ChatSource {
  private sampleMessages = [
    "alguem viu o episodio novo?",
    "vendo NFT de anime, chama no privado GOLPE",
    "esse arco ta incrivel",
  ];
  private cursor = 0;

  /**
   * Devolve uma mensagem de exemplo por chamada (simulando chegada gradual
   * de mensagens novas). Quando a lista de exemplos acaba, retorna array
   * vazio, imitando "sem mensagens novas".
   */
  async fetchNewMessages(): Promise<ChatMessage[]> {
    if (this.cursor >= this.sampleMessages.length) return [];
    const content = this.sampleMessages[this.cursor++];
    return [
      {
        id: randomUUID(),
        channelId: "geral",
        authorId: "user-1",
        authorName: "otaku123",
        content,
        createdAt: new Date().toISOString(),
      },
    ];
  }
}
