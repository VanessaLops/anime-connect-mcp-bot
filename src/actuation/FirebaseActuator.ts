import type { Database } from "firebase-admin/database";
import type { ChatActuator } from "./ChatActuator.js";
import type { BotSettings } from "../domain/botSettings.js";

/**
 * Actuator real: escreve de volta no Realtime Database. Cada grupo tem seu
 * próprio usuário-bot (criado sob demanda em `users`, marcado com
 * `is_bot: true` + `bot_group_id`), com nome e cor lidos de `BotSettings` —
 * é o que o dono personaliza em `groups/{id}/bot_settings` no app, sem
 * precisar mexer em código nem no `.env` do bot.
 *
 * `settings.active === false` faz a ação só ser logada — é o interruptor
 * "ativar de verdade" por grupo, mais granular que o DRY_RUN global do
 * `.env` (que continua sendo o disjuntor principal: se ele for `true`, o
 * processo inteiro usa `DryRunActuator` e nem chega aqui).
 *
 * `banUser`/`kickUser` ainda não mexem em `group_members` porque o formato
 * exato desse nó não foi confirmado — por segurança, só logam um aviso em
 * vez de arriscar gravar algo errado no grupo de um usuário real.
 */
export class FirebaseActuator implements ChatActuator {
  private botIdentityByGroup = new Map<number, { userId: number; name: string; avatarColor: string }>();

  constructor(private db: Database) {}

  async sendMessage(groupId: string, content: string, settings: BotSettings): Promise<void> {
    const numericGroupId = Number(groupId.replace("group:", ""));
    if (!settings.active) {
      console.log(`[grupo ${numericGroupId} - bot inativo] enviaria: "${content}"`);
      return;
    }

    const botUserId = await this.ensureBotUser(numericGroupId, settings);
    const id = await this.nextGroupMessageId();

    await this.db.ref(`group_messages/${id}`).set({
      id,
      group_id: numericGroupId,
      user_id: botUserId,
      content,
      created_at: new Date().toISOString(),
    });
  }

  async banUser(groupId: string, userId: string, reason: string, settings: BotSettings): Promise<void> {
    if (!settings.active) {
      console.log(`[grupo ${groupId} - bot inativo] baniria usuário ${userId} (motivo: ${reason})`);
      return;
    }
    console.warn(
      `[FirebaseActuator] banUser não implementado ainda (schema de group_members não confirmado): ` +
        `grupo ${groupId}, usuário ${userId}, motivo: ${reason}`
    );
  }

  async kickUser(groupId: string, userId: string, reason: string, settings: BotSettings): Promise<void> {
    if (!settings.active) {
      console.log(`[grupo ${groupId} - bot inativo] kickaria usuário ${userId} (motivo: ${reason})`);
      return;
    }
    console.warn(
      `[FirebaseActuator] kickUser não implementado ainda (schema de group_members não confirmado): ` +
        `grupo ${groupId}, usuário ${userId}, motivo: ${reason}`
    );
  }

  /**
   * Garante o usuário-bot deste grupo e mantém nome/cor sincronizados com
   * `settings`. Só escreve no Firebase quando a identidade em cache está
   * desatualizada — evita um `update` a cada mensagem enviada.
   */
  private async ensureBotUser(groupId: number, settings: BotSettings): Promise<number> {
    const cached = this.botIdentityByGroup.get(groupId);
    if (cached) {
      if (cached.name !== settings.name || cached.avatarColor !== settings.avatarColor) {
        await this.syncBotIdentity(cached.userId, settings);
        this.botIdentityByGroup.set(groupId, { userId: cached.userId, name: settings.name, avatarColor: settings.avatarColor });
      }
      return cached.userId;
    }

    const snapshot = await this.db.ref("users").get();
    const usersById = (snapshot.val() ?? {}) as Record<string, { id?: number; bot_group_id?: number }>;

    const existingBot = Object.values(usersById).find((u) => u.bot_group_id === groupId);
    if (existingBot?.id != null) {
      await this.syncBotIdentity(existingBot.id, settings);
      this.botIdentityByGroup.set(groupId, { userId: existingBot.id, name: settings.name, avatarColor: settings.avatarColor });
      return existingBot.id;
    }

    const nextId = nextIntegerKey(usersById);
    await this.db.ref(`users/${nextId}`).set({
      id: nextId,
      username: settings.name,
      is_bot: true,
      bot_group_id: groupId,
      avatar_color: settings.avatarColor,
      created_at: new Date().toISOString(),
    });

    this.botIdentityByGroup.set(groupId, { userId: nextId, name: settings.name, avatarColor: settings.avatarColor });
    return nextId;
  }

  /** Atualiza nome/cor do usuário-bot quando o dono edita `bot_settings` no app. */
  private async syncBotIdentity(userId: number, settings: BotSettings): Promise<void> {
    await this.db.ref(`users/${userId}`).update({
      username: settings.name,
      avatar_color: settings.avatarColor,
    });
  }

  private async nextGroupMessageId(): Promise<number> {
    const snapshot = await this.db.ref("group_messages").get();
    return nextIntegerKey((snapshot.val() ?? {}) as Record<string, unknown>);
  }
}

/** Próximo inteiro livre com base nas CHAVES do nó (mais confiável que um campo `id` interno, que pode faltar). */
function nextIntegerKey(byKey: Record<string, unknown>): number {
  const maxKey = Object.keys(byKey).reduce((max, key) => {
    const n = Number(key);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return maxKey + 1;
}
