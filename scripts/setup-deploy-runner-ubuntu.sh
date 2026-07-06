#!/usr/bin/env bash
# Bootstrap YBB deploy runner on Ubuntu 22.04+ (Tencent Lighthouse / VPS).
# Run as root or sudo on the deploy machine.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
REPO_DIR="${REPO_DIR:-/opt/ybb-site}"
REPO_URL="${REPO_URL:-}"  # optional git clone URL
POLL_INTERVAL="${POLL_INTERVAL:-300}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo: sudo bash scripts/setup-deploy-runner-ubuntu.sh" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git zip unzip python3 python3-pip python3-venv build-essential

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

id "$DEPLOY_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$DEPLOY_USER"
mkdir -p "$REPO_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$(dirname "$REPO_DIR")"

if [[ -n "$REPO_URL" && ! -d "$REPO_DIR/.git" ]]; then
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$REPO_DIR"
fi

if [[ ! -f "$REPO_DIR/package.json" ]]; then
  cat >&2 <<EOF
[setup] $REPO_DIR 尚无代码。请先同步仓库，例如在本机执行：

  rsync -avz --exclude node_modules --exclude out --exclude .next \\
    /path/to/omc-replica/ybb-site/ ${DEPLOY_USER}@YOUR_SERVER_IP:$REPO_DIR/

或在服务器设置 REPO_URL 后重跑本脚本。
EOF
  exit 1
fi

sudo -u "$DEPLOY_USER" bash -lc "cd '$REPO_DIR' && npm ci"
sudo -u "$DEPLOY_USER" bash -lc "cd '$REPO_DIR' && python3 -m venv .venv && .venv/bin/pip install -U pip && .venv/bin/pip install playwright requests"
sudo -u "$DEPLOY_USER" bash -lc "cd '$REPO_DIR' && .venv/bin/python -m playwright install chromium --with-deps"

chmod +x "$REPO_DIR/scripts/"*.sh 2>/dev/null || true

if [[ ! -f "$REPO_DIR/secrets.local.json" ]]; then
  cat >"$REPO_DIR/secrets.local.json" <<'JSON'
{
  "deploy": {
    "runnerKey": "PASTE_FROM_WP_ADMIN_DEPLOY_TAB"
  },
  "ftp": {
    "host": "carp-ybb.com",
    "port": 21,
    "protocol": "ftps",
    "username": "PASTE_FTP_USER",
    "password": "PASTE_FTP_PASSWORD",
    "remoteRoot": "/carp-ybb.com/public_html"
  },
  "wordpress": {
    "adminUrl": "https://carp-ybb.com/wp-admin",
    "siteUrl": "https://carp-ybb.com",
    "email": "PASTE_WP_USER",
    "password": "PASTE_WP_PASSWORD"
  }
}
JSON
  chown "$DEPLOY_USER:$DEPLOY_USER" "$REPO_DIR/secrets.local.json"
  chmod 600 "$REPO_DIR/secrets.local.json"
  echo "[setup] 已生成 $REPO_DIR/secrets.local.json 模板 — 请填入 Deploy Secret 与 FTPS 凭证"
fi

cat >/etc/systemd/system/ybb-deploy-runner.service <<EOF
[Unit]
Description=YBB static site deploy runner (poll WP queue)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$DEPLOY_USER
WorkingDirectory=$REPO_DIR
Environment=SITE=https://carp-ybb.com
ExecStart=$REPO_DIR/scripts/ybb-deploy-runner.sh --poll --interval $POLL_INTERVAL
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ybb-deploy-runner.service
systemctl restart ybb-deploy-runner.service

echo "[setup] OK — systemctl status ybb-deploy-runner"
systemctl --no-pager status ybb-deploy-runner.service || true
