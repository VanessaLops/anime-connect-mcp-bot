import type { ChatMessage } from "../domain/types.js";

export interface ChatSource {
  /** Chamado periodicamente; retorna mensagens novas desde a última chamada. */
  fetchNewMessages(): Promise<ChatMessage[]>;
}
