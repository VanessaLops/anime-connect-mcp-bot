import { config } from "../config/env.js";

export interface BotCommandToggle {
  enabled: boolean;
}

export interface PingCommandSetting extends BotCommandToggle {
  message: string;
}

export interface BotSettings {
  name: string;
  avatarColor: string;
  /** Interruptor por grupo: `false` só loga o que faria, não escreve/age de verdade. */
  active: boolean;
  commands: {
    ping: PingCommandSetting;
    help: BotCommandToggle;
    ban: BotCommandToggle;
  };
  keywordAlerts: string[];
  badwords: string[];
}

/** Usado pro MockChatSource (dev) e por qualquer grupo que ainda não salvou `bot_settings`. */
export const DEFAULT_BOT_SETTINGS: BotSettings = {
  name: "Anime Connect Bot",
  avatarColor: "#00F2FE",
  active: false,
  commands: {
    ping: { enabled: true, message: "pong! bot online 🏓" },
    help: { enabled: true },
    ban: { enabled: true },
  },
  keywordAlerts: config.keywordAlerts,
  badwords: config.badwords,
};

/** Formato bruto salvo pelo app em `groups/{id}/bot_settings` (mesma convenção snake_case do resto do banco). */
interface RawBotSettings {
  name?: string;
  avatar_color?: string;
  active?: boolean;
  commands?: {
    ping?: { enabled?: boolean; message?: string };
    help?: { enabled?: boolean };
    ban?: { enabled?: boolean };
  };
  keyword_alerts?: string;
  badwords?: string;
}

function splitList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  const list = raw
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : fallback;
}

/** Converte o que o dono salvou no app pra config do bot, preenchendo qualquer campo faltante com o default. */
export function parseBotSettings(raw: RawBotSettings | null | undefined): BotSettings {
  if (!raw) return DEFAULT_BOT_SETTINGS;
  return {
    name: raw.name?.trim() || DEFAULT_BOT_SETTINGS.name,
    avatarColor: raw.avatar_color || DEFAULT_BOT_SETTINGS.avatarColor,
    active: raw.active ?? DEFAULT_BOT_SETTINGS.active,
    commands: {
      ping: {
        enabled: raw.commands?.ping?.enabled ?? DEFAULT_BOT_SETTINGS.commands.ping.enabled,
        message: raw.commands?.ping?.message?.trim() || DEFAULT_BOT_SETTINGS.commands.ping.message,
      },
      help: { enabled: raw.commands?.help?.enabled ?? DEFAULT_BOT_SETTINGS.commands.help.enabled },
      ban: { enabled: raw.commands?.ban?.enabled ?? DEFAULT_BOT_SETTINGS.commands.ban.enabled },
    },
    keywordAlerts: splitList(raw.keyword_alerts, DEFAULT_BOT_SETTINGS.keywordAlerts),
    badwords: splitList(raw.badwords, DEFAULT_BOT_SETTINGS.badwords),
  };
}

/** `false` quando o dono desligou esse comando pro grupo — a mensagem se comporta como se ele não existisse. */
export function isCommandEnabled(trigger: string, settings: BotSettings): boolean {
  switch (trigger) {
    case "ping":
      return settings.commands.ping.enabled;
    case "help":
      return settings.commands.help.enabled;
    case "ban":
      return settings.commands.ban.enabled;
    default:
      return true;
  }
}
