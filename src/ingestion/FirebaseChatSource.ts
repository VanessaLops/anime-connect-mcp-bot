import type { Database } from "firebase-admin/database";
import type { ChatSource } from "./ChatSource.js";
import type { ChatMessage } from "../domain/types.js";
import { DJ_BOT_SETTINGS, parseBotSettings } from "../domain/botSettings.js";
import type { GroupBots } from "../domain/botSettings.js";

interface RawGroupMessage {
  id: number;
  group_id: number;
  user_id: number;
  content: string;
  created_at: string;
}

/**
 * Lê `group_messages` do Realtime Database do app Anime Connect, mas só
 * dos grupos com algum bot ligado pelo dono no app (`has_bot` = moderador,
 * `has_dj` = DJ).
 * Mantém em memória o último `created_at` visto pra só trazer mensagens novas.
 */
export class FirebaseChatSource implements ChatSource {
  private userNameCache = new Map<string, string>();

  /**
   * `lastSeenAt` é de onde retomar — sem isso, cada reinício reprocessaria o
   * histórico inteiro e o bot responderia de novo a todo comando antigo.
   */
  constructor(private db: Database, private lastSeenAt: string) {}

  async fetchNewMessages(): Promise<ChatMessage[]> {
    const activeGroupIds = await this.getGroupsWithBotEnabled();
    if (activeGroupIds.size === 0) return [];

    const snapshot = await this.db.ref("group_messages").get();
    if (!snapshot.exists()) return [];

    const raw = Object.values(snapshot.val() as Record<string, RawGroupMessage>);
    const relevant = raw.filter(
      (m) => activeGroupIds.has(m.group_id) && m.created_at > this.lastSeenAt
    );
    if (relevant.length === 0) return [];

    this.lastSeenAt = relevant.reduce((max, m) => (m.created_at > max ? m.created_at : max), this.lastSeenAt);

    const messages: ChatMessage[] = [];
    for (const m of relevant) {
      messages.push({
        id: `gm-${m.id}`,
        channelId: `group:${m.group_id}`,
        authorId: String(m.user_id),
        authorName: await this.resolveUserName(m.user_id),
        content: m.content,
        createdAt: m.created_at,
      });
    }
    return messages;
  }

  private groupOwnerCache = new Map<number, string>();
  private botUserCache = new Map<number, boolean>();

  /** Retorna o `created_by` do grupo (usado pra saber quem é o dono/owner). */
  async getGroupOwner(groupId: number): Promise<string | null> {
    const cached = this.groupOwnerCache.get(groupId);
    if (cached) return cached;

    const snapshot = await this.db.ref(`groups/${groupId}/created_by`).get();
    if (!snapshot.exists()) return null;

    const ownerId = String(snapshot.val());
    this.groupOwnerCache.set(groupId, ownerId);
    return ownerId;
  }

  /**
   * `true` pra subdono/staff do grupo ou administração do app. Sem cache de
   * propósito: cargo muda pelo app a qualquer hora e só é consultado em comando.
   */
  async isGroupAdmin(groupId: number, userId: number): Promise<boolean> {
    const appRole = (await this.db.ref(`users/${userId}/role`).get()).val();
    if (appRole === "admin") return true;

    const snapshot = await this.db.ref("group_members").get();
    const members = Object.values((snapshot.val() ?? {}) as Record<string, { group_id: number; user_id: number; role: string }>);
    const membership = members.find((m) => m.group_id === groupId && m.user_id === userId);
    return membership?.role === "subowner" || membership?.role === "staff";
  }

  /** `true` se o autor é um usuário-bot — usado pra não reagir às próprias mensagens do bot. */
  async isBotUser(userId: number): Promise<boolean> {
    const cached = this.botUserCache.get(userId);
    if (cached != null) return cached;

    const snapshot = await this.db.ref(`users/${userId}/is_bot`).get();
    const isBot = snapshot.val() === true;
    this.botUserCache.set(userId, isBot);
    return isBot;
  }

  async getGroupsWithBotEnabled(): Promise<Set<number>> {
    const snapshot = await this.db.ref("groups").get();
    if (!snapshot.exists()) return new Set();
    const groups = Object.values(snapshot.val() as Record<string, { id: number; has_bot?: boolean; has_dj?: boolean }>);
    return new Set(groups.filter((g) => g.has_bot === true || g.has_dj === true).map((g) => g.id));
  }

  /**
   * Quais bots o grupo tem ligados agora, cada um com sua config. A do
   * moderador o dono personaliza em `groups/{id}/bot_settings` no app.
   */
  async getGroupBots(groupId: number): Promise<GroupBots> {
    const snapshot = await this.db.ref(`groups/${groupId}`).get();
    const group = snapshot.val() as { has_bot?: boolean; has_dj?: boolean; bot_settings?: unknown } | null;
    const bots: GroupBots = {};
    if (group?.has_bot === true) bots.mod = parseBotSettings(group.bot_settings as Parameters<typeof parseBotSettings>[0]);
    if (group?.has_dj === true) bots.dj = DJ_BOT_SETTINGS;
    return bots;
  }

  private async resolveUserName(userId: number): Promise<string> {
    const key = String(userId);
    const cached = this.userNameCache.get(key);
    if (cached) return cached;

    const snapshot = await this.db.ref(`users/${userId}`).get();
    const user = snapshot.val() as Record<string, unknown> | null;
    const name =
      (user?.name as string) ??
      (user?.username as string) ??
      (user?.nickname as string) ??
      key;

    this.userNameCache.set(key, name);
    return name;
  }
}
