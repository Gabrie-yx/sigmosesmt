#!/usr/bin/env bash
# SIGMO — instala o serviço que mantém o app SEMPRE no ar.
# Rodar UMA vez no servidor DMN, como usuário com sudo:
#   bash /home/sigmo/app/scripts/sigmo-service.sh
#
# Depois disso, se o app cair (crash, OOM, reboot), o systemd sobe sozinho
# em até 5 segundos — nada de 502 Bad Gateway na manhã seguinte.
set -euo pipefail

APP=/home/sigmo/app
USER_APP=sigmo
PORT=8080
UNIT=/etc/systemd/system/sigmo.service

BUN=$(command -v bun || echo /home/sigmo/.bun/bin/bun)
[ -x "$BUN" ] || { echo "!! bun não encontrado. Ajuste a variável BUN neste script."; exit 1; }

sudo tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=SIGMO (app web)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=${USER_APP}
WorkingDirectory=${APP}
EnvironmentFile=-${APP}/.env
ExecStart=${BUN} run dev --host 0.0.0.0 --port ${PORT}
Restart=always
RestartSec=5
StartLimitIntervalSec=0
StandardOutput=append:/home/sigmo/sigmo.log
StandardError=append:/home/sigmo/sigmo.log
# memória: se estourar, o systemd reinicia em vez de deixar morto
OOMPolicy=restart

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now sigmo.service
sleep 5
sudo systemctl status sigmo.service --no-pager -l | head -20
echo
echo "Pronto. Comandos úteis:"
echo "  sudo systemctl restart sigmo   # reiniciar"
echo "  sudo systemctl status sigmo    # ver estado"
echo "  tail -f /home/sigmo/sigmo.log  # ver log"
