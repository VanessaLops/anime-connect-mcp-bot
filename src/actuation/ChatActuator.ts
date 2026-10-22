import type { BotSettings } from "../domain/botSettings.js";
import { EMPTY_MUSIC, type MusicState } from "../music/dj.js";

export interface ChatActuator {
  sendMessage(groupId: string, content: string, settings: BotSettings): Promise<void>;
  banUser(groupId: string, userId: string, reason: string, settings: BotSettings): Promise<void>;
  kickUser(groupId: string, userId: string, reason: string, settings: BotSettings): Promise<void>;
  /** O que toca agora e a fila de pedidos do grupo. */
  getMusic(groupId: string): Promise<MusicState>;
  setMusic(groupId: string, state: MusicState, settings: BotSettings): Promise<void>;
}

/**
 * Actuator seguro pra desenvolvimento: em vez de escrever no Firebase de
 * verdade, só loga a ação que seria tomada. Usar até confirmar que o bot
 * pode agir de fato no chat dos usuários reais.
 */
export class DryRunActuator implements ChatActuator {
  /** Sem Firebase pra guardar, a fila vive na memória — só pra dar pra testar a sequência de comandos. */
  private music = new Map<string, MusicState>();

  async sendMessage(groupId: string, content: string): Promise<void> {
    console.log(`[dry-run] enviaria no grupo ${groupId}: "${content}"`);
  }

  async banUser(groupId: string, userId: string, reason: string): Promise<void> {
    console.log(`[dry-run] baniria usuário ${userId} do grupo ${groupId} (motivo: ${reason})`);
  }

  async kickUser(groupId: string, userId: string, reason: string): Promise<void> {
    console.log(`[dry-run] kickaria usuário ${userId} do grupo ${groupId} (motivo: ${reason})`);
  }

  async getMusic(groupId: string): Promise<MusicState> {
    return this.music.get(groupId) ?? EMPTY_MUSIC;
  }

  async setMusic(groupId: string, state: MusicState): Promise<void> {
    this.music.set(groupId, state);
    console.log(`[dry-run] tocaria no grupo ${groupId}: ${state.now ? state.now.title : "(parar)"} | fila: ${state.queue.length}`);
  }
}
