import type { BotSettings } from "../domain/botSettings.js";

export interface ChatActuator {
  sendMessage(groupId: string, content: string, settings: BotSettings): Promise<void>;
  banUser(groupId: string, userId: string, reason: string, settings: BotSettings): Promise<void>;
  kickUser(groupId: string, userId: string, reason: string, settings: BotSettings): Promise<void>;
}

/**
 * Actuator seguro pra desenvolvimento: em vez de escrever no Firebase de
 * verdade, só loga a ação que seria tomada. Usar até confirmar que o bot
 * pode agir de fato no chat dos usuários reais.
 */
export class DryRunActuator implements ChatActuator {
  async sendMessage(groupId: string, content: string): Promise<void> {
    console.log(`[dry-run] enviaria no grupo ${groupId}: "${content}"`);
  }

  async banUser(groupId: string, userId: string, reason: string): Promise<void> {
    console.log(`[dry-run] baniria usuário ${userId} do grupo ${groupId} (motivo: ${reason})`);
  }

  async kickUser(groupId: string, userId: string, reason: string): Promise<void> {
    console.log(`[dry-run] kickaria usuário ${userId} do grupo ${groupId} (motivo: ${reason})`);
  }
}
