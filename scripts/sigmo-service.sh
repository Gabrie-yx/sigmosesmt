#!/usr/bin/env bash
# SIGMO — mantém o app SEMPRE no ar (fim do "502 Bad Gateway" de manhã).
# Rodar como usuário com sudo (ex.: fbalmeida). Pode rodar quantas vezes quiser:
#   bash /home/sigmo/app/scripts/sigmo-service.sh
#
# Instala 3 proteções:
#  1. sigmo.service   — sobe o app no boot e reergue em 5s se ele MORRER.
#  2. sigmo-watchdog  — a cada 2 min testa se o app RESPONDE; se travou
#                       (processo vivo mas mudo), reinicia sozinho.
#  3. logrotate       — impede o log de crescer até lotar o disco.
set -uo pipefail

APP=/home/sigmo/app
USER_APP=sigmo
PORT=8080
UNIT=/etc/systemd/system/sigmo.service
LOG=/home/sigmo/sigmo.log
WLOG=/home/sigmo/watchdog.log

say(){ printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }

# bun do usuário sigmo primeiro (quem roda o sudo pode não ter bun no PATH)
BUN=""
for c in /home/sigmo/.bun/bin/bun "$(sudo -u "$USER_APP" bash -lc 'command -v bun' 2>/dev/null)" "$(command -v bun 2>/dev/null)"; do
  [ -n "$c" ] && [ -x "$c" ] && { BUN="$c"; break; }
done
[ -n "$BUN" ] || { echo "!! bun não encontrado para o usuário sigmo."; exit 1; }
echo "bun: $BUN"

say "Diagnóstico antes da correção"
echo "Ligado desde: $(uptime -s)"
df -h / /home 2>/dev/null | sed 's/^/  /'
if systemctl list-unit-files 2>/dev/null | grep -q '^sigmo\.service'; then
  echo "Serviço sigmo já existia: $(systemctl is-active sigmo.service)"
else
  echo "Serviço sigmo NÃO existia (causa provável do 502 matinal)"
fi
[ -f "$LOG" ] && { echo "Últimas linhas do log:"; tail -15 "$LOG" | sed 's/^/  /'; }

say "Parando instâncias soltas (PM2/nohup) que disputam a porta $PORT"
sudo -u "$USER_APP" bash -lc 'command -v pm2 >/dev/null && { pm2 delete all; pm2 unstartup systemd >/dev/null 2>&1; pm2 save --force; }' >/dev/null 2>&1 || true
sudo systemctl disable --now "pm2-${USER_APP}.service" >/dev/null 2>&1 || true
sudo pkill -u "$USER_APP" -f "vite.*--port ${PORT}" 2>/dev/null || true
sudo pkill -u "$USER_APP" -f "$APP/node_modules/.bin/vite" 2>/dev/null || true
sleep 2

say "1/3 Serviço principal"
sudo tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=SIGMO (app web)
After=network-online.target docker.service
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=${USER_APP}
WorkingDirectory=${APP}
Environment=HOME=/home/${USER_APP}
Environment=PATH=$(dirname "$BUN"):/usr/local/bin:/usr/bin:/bin
EnvironmentFile=-${APP}/.env
ExecStart=${BUN} run dev --host 0.0.0.0 --port ${PORT}
Restart=always
RestartSec=5
TimeoutStopSec=15
StandardOutput=append:${LOG}
StandardError=append:${LOG}
OOMPolicy=continue

[Install]
WantedBy=multi-user.target
EOF

say "2/3 Vigia (reinicia se o app travar sem morrer)"
sudo tee /usr/local/bin/sigmo-watchdog >/dev/null <<EOF
#!/usr/bin/env bash
code=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 http://127.0.0.1:${PORT}/app || echo 000)
case "\$code" in 2*|3*) rm -f /run/sigmo-watchdog.fail; exit 0 ;; esac
# não mexe se o app acabou de subir (primeira compilação demora)
up=\$(systemctl show sigmo.service -p ActiveEnterTimestampMonotonic --value)
now=\$(awk '{print int(\$1*1000000)}' /proc/uptime)
[ -n "\$up" ] && [ \$(( (now - up) / 1000000 )) -lt 180 ] && exit 0
if [ -f /run/sigmo-watchdog.fail ]; then
  echo "\$(date '+%F %T') app sem resposta (HTTP \$code) 2x seguidas -> reiniciando" >> ${WLOG}
  rm -f /run/sigmo-watchdog.fail
  systemctl restart sigmo.service
else
  touch /run/sigmo-watchdog.fail
fi
EOF
sudo chmod +x /usr/local/bin/sigmo-watchdog
sudo tee /etc/systemd/system/sigmo-watchdog.service >/dev/null <<'EOF'
[Unit]
Description=SIGMO watchdog
[Service]
Type=oneshot
ExecStart=/usr/local/bin/sigmo-watchdog
EOF
sudo tee /etc/systemd/system/sigmo-watchdog.timer >/dev/null <<'EOF'
[Unit]
Description=SIGMO watchdog a cada 2 minutos
[Timer]
OnBootSec=3min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
EOF

say "3/3 Rotação do log (não lota o disco)"
sudo tee /etc/logrotate.d/sigmo >/dev/null <<EOF
${LOG} ${WLOG} /home/sigmo/deploy.log {
  daily
  rotate 7
  maxsize 50M
  compress
  missingok
  notifempty
  copytruncate
}
EOF

sudo systemctl daemon-reload
sudo systemctl enable sigmo.service sigmo-watchdog.timer >/dev/null 2>&1
sudo systemctl restart sigmo.service
sudo systemctl start sigmo-watchdog.timer

say "Aguardando o SIGMO responder (até 2 min)"
for i in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${PORT}/app" || echo 000)
  case "$code" in 2*|3*) echo "  NO AR em ${i}s (HTTP $code)"; break ;; esac
  sleep 1
done
echo "  serviço: $(systemctl is-active sigmo.service) | vigia: $(systemctl is-active sigmo-watchdog.timer)"
echo
echo "Pronto. Comandos úteis:"
echo "  sudo systemctl status sigmo   # estado"
echo "  tail -f ${LOG}                # log do app"
echo "  cat ${WLOG}                   # quando o vigia precisou agir"
