# anime-connect-mcp-bot

Servidor MCP que monitora o chat do app Anime Connect e expõe os dados (mensagens, alertas)
como ferramentas para um assistente de IA (Claude) consultar.

## Camadas

- `src/ingestion` — capta mensagens da fonte de chat. `FirebaseChatSource` lê os grupos com
  `has_bot: true` do Realtime Database; `MockChatSource` fica só para dev/teste.
- `src/domain` — entidades (`ChatMessage`, `Alert`), regras puras (detecção de palavras-chave)
  e `botSettings.ts` (personalização por grupo, ver abaixo).
- `src/actuation` — escreve de volta no chat (`FirebaseActuator`) ou só loga (`DryRunActuator`).
- `src/agent` — comandos do chat (`!ping`, `!help`, `!ban`) e permissões por cargo.
- `src/storage` — persistência em SQLite (`MessageRepository`).
- `src/mcp` — servidor MCP com as tools `get_recent_messages`, `search_messages`,
  `get_recent_alerts`.
- `src/config` — variáveis de ambiente (`DB_PATH`, `POLL_INTERVAL_MS`, `DRY_RUN`).

## Personalização por grupo (`bot_settings`)

O dono de cada grupo edita o bot pelo próprio app Anime Connect (tela de configuração do
bot), o que grava em `groups/{id}/bot_settings` no Realtime Database:

- **Identidade**: `name` e `avatar_color` — o usuário-bot desse grupo é criado/atualizado
  com esses valores (`FirebaseActuator`, campo `bot_group_id` liga o usuário ao grupo).
- **Ativação real**: `active` — enquanto `false`, o bot só loga o que faria nesse grupo,
  mesmo com `DRY_RUN=false` no `.env` (que continua sendo o disjuntor geral do processo).
- **Comandos**: `commands.ping/help/ban.enabled` liga/desliga cada um; `commands.ping.message`
  é a resposta customizada do `!ping`.
- **Moderação**: `keyword_alerts` e `badwords`, strings separadas por vírgula, substituem os
  `KEYWORD_ALERTS`/`BADWORDS` globais do `.env` para aquele grupo.

Grupo sem `bot_settings` salvo usa os defaults de `src/domain/botSettings.ts`
(`DEFAULT_BOT_SETTINGS`), com `active: false` por segurança.

## Rodar

```bash
npm install
npm run dev     # modo desenvolvimento (tsx watch)
npm run build && npm start   # build + produção
```

## Próximo passo

Substituir `MockChatSource` por uma implementação real que fale com o app Anime Connect
(API REST, webhook ou leitura direta do banco, dependendo de como o chat do app é exposto).
