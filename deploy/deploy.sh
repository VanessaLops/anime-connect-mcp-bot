#!/usr/bin/env bash
# Publica o bot numa VPS (Ubuntu/Debian) via SSH.
# Uso: ./deploy/deploy.sh root@IP_DA_VPS
set -euo pipefail

TARGET="${1:?uso: ./deploy/deploy.sh root@IP_DA_VPS}"
APP_DIR=/opt/anime-connect-bot
cd "$(dirname "$0")/.."

echo ">> Preparando servidor (Node 22, usuário animebot)..."
ssh "$TARGET" bash -s <<'EOF'
set -euo pipefail
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs build-essential python3 rsync
fi
command -v rsync >/dev/null || apt-get install -y rsync
id animebot >/dev/null 2>&1 || useradd --system --home /opt/anime-connect-bot --shell /usr/sbin/nologin animebot
mkdir -p /opt/anime-connect-bot/data /opt/anime-connect-bot/secrets
EOF

echo ">> Enviando código..."
rsync -az --delete \
  --exclude node_modules --exclude dist --exclude .git --exclude .claude \
  --exclude data --exclude secrets --exclude .env \
  ./ "$TARGET:$APP_DIR/"

echo ">> Enviando .env e credencial do Firebase..."
rsync -az .env "$TARGET:$APP_DIR/.env"
rsync -az secrets/ "$TARGET:$APP_DIR/secrets/"

echo ">> Instalando dependências, build e serviço..."
ssh "$TARGET" bash -s <<EOF
set -euo pipefail
cd $APP_DIR
npm install --no-audit --no-fund
npm run build
npm prune --omit=dev
chown -R animebot:animebot $APP_DIR
chmod 600 .env secrets/*
cp deploy/anime-connect-bot.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable anime-connect-bot
systemctl restart anime-connect-bot
sleep 3
systemctl --no-pager status anime-connect-bot | head -15
EOF

echo ">> Pronto. Logs: ssh $TARGET journalctl -u anime-connect-bot -f"
